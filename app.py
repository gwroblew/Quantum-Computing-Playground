"""Backend service for the JavaScript app.

Handles Datastore model and JSON calls from the browser.
Also includes environment information call.
"""

import datetime
import json
import logging
import os

import webapp2

from google.appengine.api import memcache
from google.appengine.api import users
from google.appengine.ext import ndb


# How long items will be kept in memcache, in seconds.
MEMCACHE_TIMEOUT = 60


def _GetNickname(user):
  if user:
    return user.nickname()
  return 'anonymous'


class RestHandler(webapp2.RequestHandler):
  """Handler helper for REST requests/responses."""

  def respond(self, msg):
    """Serializes object to JSON and sends as HTTP response.

    Args:
      msg: Object to be serialized and sent.
    """
    self.response.headers['Content-Type'] = 'application/javascript'
    self.response.out.write(json.dumps(msg))


class QScript(ndb.Model):
  """Datastore model class for QScript entity."""
  author = ndb.UserProperty()
  content = ndb.TextProperty()
  created = ndb.DateTimeProperty(auto_now_add=True)
  modified = ndb.DateTimeProperty(auto_now=True)
  name = ndb.StringProperty(indexed=True)
  example = ndb.BooleanProperty(indexed=True)

  @staticmethod
  def CacheKey(qid):
    """Returns string key used in memcache operations."""
    return str(qid) + '|qscript'

  def AsDict(self):
    """Converts complete object state to dict.

    Returns:
      Dict contains names of properties mapped to values suitable for display
      on client side in browser.
    """
    update = True
    if ((self.example and not users.is_current_user_admin()) or
        (not self.example and self.author != users.get_current_user())):
      update = False
    return {
        'id': str(self.key.id()),
        'author': _GetNickname(self.author),
        'content': self.content,
        'created': self.created.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'modified': self.modified.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'name': self.name,
        'example': self.example,
        'admin': users.is_current_user_admin(),
        'update': update
    }

  def PartAsDict(self):
    """Returns partial object state as dict."""
    return {
        'id': str(self.key.id()),
        'created': self.created.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'modified': self.modified.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'name': self.name
    }


class Comment(ndb.Model):
  """Datastore model class for Comment entity."""
  author = ndb.UserProperty()
  content = ndb.TextProperty()
  created = ndb.DateTimeProperty(auto_now_add=True)
  qscript = ndb.KeyProperty(kind=QScript)

  @staticmethod
  def CacheKey(qid):
    """Returns string key used in memcache operations."""
    return str(qid) + '|comments'

  def AsDict(self):
    """Returns complete object state as dict."""
    return {
        'id': str(self.key.id()),
        'author': _GetNickname(self.author),
        'content': self.content,
        'created': self.created.strftime('%Y-%m-%dT%H:%M:%SZ')
    }


class GetUserInfoCtrl(RestHandler):
  """Load user information data for JS app."""

  def get(self):  # pylint: disable=g-bad-name
    user = users.get_current_user()
    if not user:
      self.respond({'nickname': '',
                    'url': users.create_login_url(self.request.referer)})
    else:
      self.respond({'nickname': user.nickname(),
                    'url': users.create_logout_url(self.request.referer)})


class SaveScriptCtrl(RestHandler):
  """Save script data from JS app."""

  def post(self):  # pylint: disable=g-bad-name
    """Handles script saving request.

    Expects JSON dict with script id, content, and title (name).
    If id refers to non-existent script creates a new entity, otherwise
    updates existing one.
    """
    params = json.loads(self.request.body)
    qid = long(params['id'])
    qscript = None
    if qid is None or qid != 0:
      key = ndb.Key(QScript, qid)
      qscript = key.get()
    user = users.get_current_user()
    # Logic here:
    # Example Admin Different_user New_qscript
    # E  A  D  N
    # 0  0  0  0 (user can overwrite own scripts)
    # 0  0  1  1
    # 0  1  0  0 (admin can overwrite own scripts)
    # 0  1  1  1
    # 1  0  0  1 (should never happen)
    # 1  0  1  1
    # 1  1  0  0 (only admins can overwrite
    # 1  1  1  0  examples)
    if (not qscript or
        (qscript.example and not users.is_current_user_admin()) or
        (not qscript.example and qscript.author != user)):
      qscript = QScript()
      qscript.author = user
      qscript.example = False
    qscript.content = params['content']
    qscript.name = params['name']
    qscript.put()
    if not memcache.set(QScript.CacheKey(qscript.key.id()), qscript,
                        time=MEMCACHE_TIMEOUT):
      logging.error('Memcache set failed!')
    self.respond({'qscriptId': str(qscript.key.id())})


class LoadScriptCtrl(RestHandler):
  """Load script data for JS app."""

  def post(self):  # pylint: disable=g-bad-name
    """Handles script data loading request.

    Expects JSON dict with script id.
    If script exists returns complete script record, otherwise
    returns empty new script template.
    """
    params = json.loads(self.request.body)
    qid = long(params['id'])
    qscript = None
    if qid:
      qscript = memcache.get(QScript.CacheKey(qid))
      if not qscript:
        qscript = ndb.Key(QScript, qid).get()
        if (qscript and
            not memcache.set(QScript.CacheKey(qid), qscript,
                             time=MEMCACHE_TIMEOUT)):
          logging.error('Memcache set failed!')
    if qscript:
      self.respond(qscript.AsDict())
    else:
      self.respond({
          'id': '0',
          'name': 'New script',
          'content': '',
          'created': '',
          'modified': '',
          'author': _GetNickname(users.get_current_user()),
          'admin': users.is_current_user_admin(),
          'update': False,
          'example': False
      })


class AddCommentCtrl(RestHandler):
  """Add comment for a script from JS app."""

  def post(self):  # pylint: disable=g-bad-name
    """Handles request adding comment to a script.

    Expects JSON dict with script id and comment content.
    Returns comment id of newly added comment, zero if user is not logged in.
    """
    params = json.loads(self.request.body)
    user = users.get_current_user()
    if not user:
      self.respond({'commentId': '0'})
      return
    qid = long(params['qscriptId'])
    key = ndb.Key(QScript, qid)
    memcache.delete(Comment.CacheKey(qid))
    comment = Comment()
    comment.author = user
    comment.content = params['content']
    comment.qscript = key
    comment.put()
    self.respond({'commentId': str(comment.key.id())})


class DeleteCommentCtrl(RestHandler):
  """Delete comment for a script from JS app."""

  def post(self):  # pylint: disable=g-bad-name
    """Handles comment removal request.

    Expects JSON dict with comment id.
    Responds with comment id zero if removal was successful,
    original comment id otherwise.
    """
    params = json.loads(self.request.body)
    cid = long(params['id'])
    user = users.get_current_user()
    key = ndb.Key(Comment, cid)
    comment = key.get()
    # Only allow admins and comment author to remove.
    if comment and (comment.author == user or users.is_current_user_admin()):
      memcache.delete(Comment.CacheKey(comment.qscript.id()))
      key.delete()
      self.respond({'commentId': '0'})
    else:
      self.respond({'commentId': str(comment.key.id())})


class LoadCommentsCtrl(RestHandler):
  """Load comments in given script for JS app."""

  def post(self):  # pylint: disable=g-bad-name
    """Handles request to get all comments for given script.

    Expects JSON dict with script id.
    Responds with array of comments data with comment ids removed for
    non-admins and non-author of a comment.
    """
    params = json.loads(self.request.body)
    qid = long(params['qscriptId'])
    if qid is None or qid == 0:
      self.respond([])
      return
    response = memcache.get(Comment.CacheKey(qid))
    if not response:
      qskey = ndb.Key(QScript, qid)
      comments = Comment.query(Comment.qscript == qskey)
      if comments:
        response = [cmt.AsDict() for cmt in comments]
        if not memcache.set(Comment.CacheKey(qid), response,
                            time=MEMCACHE_TIMEOUT):
          logging.error('Memcache set failed!')
      else:
        response = []
    nickname = _GetNickname(users.get_current_user())
    admin = users.is_current_user_admin()
    # Only allow admins and comment author to see comment id.
    for cmt in response:
      if cmt['author'] != nickname and not admin:
        cmt['id'] = ''
    self.respond(response)


class LoadMyScriptsCtrl(RestHandler):
  """Load script titles of current user scripts."""

  def get(self):  # pylint: disable=g-bad-name
    """Handles request to load the list of scripts created by current user.

    Returns array of partial script data with script titles, created date,
    and modified date.
    """
    user = users.get_current_user()
    if not user:
      self.respond([])
      return
    scripts = QScript.query(QScript.author == user)
    scripts.fetch(projection=['created', 'modified', 'name'])
    self.respond([qs.PartAsDict() for qs in scripts])


class RemoveOldScriptsCtrl(RestHandler):
  """Remove old scripts created by anonymous users."""

  def get(self):  # pylint: disable=g-bad-name
    """Handles request to clean up scripts.

    Removes all anonymous scripts not touched in last 90 days.
    """
    user = users.get_current_user()
    if not user or not users.is_current_user_admin():
      self.respond([])
      return
    cutoff = datetime.today() - datetime.timedelta(days=90)
    scripts = QScript.query(QScript.author is None, QScript.modified < cutoff)
    scripts.fetch(projection=['created', 'modified', 'name'])
    for qs in scripts:
      memcache.delete(QScript.CacheKey(qs.key.id()))
      memcache.delete(Comment.CacheKey(qs.key.id()))
      qs.key.delete()
    self.respond([qs.PartAsDict() for qs in scripts])


app = webapp2.WSGIApplication([
    ('/getuserinfo', GetUserInfoCtrl),
    ('/savescript', SaveScriptCtrl),
    ('/loadscript', LoadScriptCtrl),
    ('/addcomment', AddCommentCtrl),
    ('/deletecomment', DeleteCommentCtrl),
    ('/loadcomments', LoadCommentsCtrl),
    ('/loadmyscripts', LoadMyScriptsCtrl),
    ('/removeoldscripts', RemoveOldScriptsCtrl)
])
