/**
 * @fileoverview Defines math functions used in QC algorithms.
 */

var QMath = {};


/**
 * Returns integer power a^b.
 * @param {number} a Base integer number.
 * @param {number} b Power integer number.
 * @return {number} a^b result.
 */
QMath.ipow = function(a, b) {
  var i, r = 1;

  for (i = 0; i < b; i++)
    r *= a;

  return r;
};


/**
 * Calculates the greatest common divisor with Euclid's algorithm.
 * @param {number} u First number.
 * @param {number} v Second number.
 * @return {number} GCD.
 */
QMath.gcd = function(u, v) {
  var r;

  while (v) {
    r = u % v;
    u = v;
    v = r;
  }
  return u;
};


/**
 * Calculates fractional approximation of a decimal value.
 * @param {number} a Nominator of the value.
 * @param {number} b Denominator of the value.
 * @param {number} width Accuracy, given as number of bits.
 * @return {!Array.<number>} Approximating fraction.
 */
QMath.fracApprox = function(a, b, width) {
  var f = a / b;
  var g = f;
  var i, num2 = 0, den2 = 1, num1 = 1, den1 = 0, num = 0, den = 0;

  do {
    i = Math.round(g + 0.000005);

    g -= i - 0.000005;
    g = 1.0 / g;

    if (i * den1 + den2 > 1 << width)
      break;

    num = i * num1 + num2;
    den = i * den1 + den2;

    num2 = num1;
    den2 = den1;
    num1 = num;
    den1 = den;

  } while (Math.abs((num / den) - f) > 1.0 / (2 * (1 << width)));

  return [num, den];
};


/**
 * Calculates the number of bits required to store a value.
 * @param {number} n Value to store.
 * @return {number} Number of bits required.
 */
QMath.getWidth = function(n) {
  var i;

  for (i = 1; 1 << i < n; i++) {}

  return i;
};


/**
 * Calculate the inverse modulus of N and C.
 * @param {number} n Value N.
 * @param {number} c Value C.
 * @return {number} Inverse modulus of N and C.
 */
QMath.inverseMod = function(n, c) {
  var i;

  for (i = 1; (i * c) % n != 1; i++) {}

  return i;
};


/**
 * Calculates x^k mod N using standard exponentiation by squaring mod N,
 * also known as right-to-left binary method.
 * @param {number} x Base.
 * @param {number} k Exponent.
 * @param {number} N Modulus.
 * @return {number} x^k mod N.
 */
QMath.expModN = function(x, k, N) {
  var base = x % N;
  var result = 1, exp = k;

  while (exp > 0) {
    if (exp & 1) {
      result = (result * base) % N;
    }
    base = (base * base) % N;
    exp >>= 1;
  }

  return result;
};
