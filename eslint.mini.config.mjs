import globals from "globals";

export default [{
  files: ["miniprogram/**/*.js"],
  ignores: ["miniprogram/utils/locale-copy.js"],
  languageOptions: {
    ecmaVersion: "latest", sourceType: "commonjs",
    globals: { ...globals.es2021, wx: "readonly", App: "readonly", Page: "readonly", getApp: "readonly", getCurrentPages: "readonly", console: "readonly", setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly" },
  },
  rules: { "no-undef": "error", "no-unreachable": "error", "no-dupe-keys": "error", "no-constant-condition": "error" },
}];
