Quantum-Computing-Playground
============================

Source code of quantumplayground.net.

To deploy your own copy of Quantum Computing Playground:

 - fork GitHub project
 - create Google AppEngine project (https://console.developers.google.com/project -> "Create Project")
 - enable Google Cloud Datastore API (APIS & AUTH -> APIs -> Google Cloud Datastore API -> "On")
 - link your GitHub project to GAE project (Source Code -> Releases -> Update -> "Configure Your Repository" -> "Connect a GitHub repo")

At this point each push into your GitHub project should initiate AppEngine deployment and the website will be accessible under: http://your-project-name.appspot.com

To populate examples create new scripts manually, record script identifiers from the playground URL, then paste them in module.js (see: https://github.com/gwroblew/Quantum-Computing-Playground/commit/745851aa9b466fdc4ef186cf26f8f99ca2d522fc).
