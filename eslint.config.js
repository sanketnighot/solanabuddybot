import globals from "globals"
import pluginJs from "@eslint/js"

export default [
  { languageOptions: { globals: globals.node } },
  { files: ["*.js"] },
  {
    rules: {
      "no-console": "error",
      quotes: ["error", "double", { allowTemplateLiterals: true }],
    },
  },
  pluginJs.configs.recommended,
]
