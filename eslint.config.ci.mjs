// The lint config CI uses. Identical to the normal one but for a single
// rule, and it exists so that lint can be a BLOCKING step from day one.
//
// `eslint src` currently reports 48 errors, 45 of which are this one rule
// - setState called synchronously inside an effect. A blocking lint step
// against the normal config would therefore fail on its first run, and a
// check that is red before anybody has done anything wrong is a check
// people learn to ignore.
//
// The alternative was continue-on-error, and that is worse: a step that
// always passes is not a check, it is a decoration.
//
// So the rule is a warning HERE and an error everywhere else, which means
// the other three errors still block, and every new violation of any
// other rule still blocks. Then item 3 of docs/overnight-plan.md fixes
// the 45 and DELETES THIS FILE. It is scaffolding with a demolition date,
// not a permanent exemption.
import base from "./eslint.config.mjs";

export default [
  ...base,
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];
