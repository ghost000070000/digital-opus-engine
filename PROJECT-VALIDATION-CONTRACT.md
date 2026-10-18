# Digital Opus Project Validation Contract

## Collector

`collectProjectIssues(project, options)` is the bounded central collector. It aggregates:

- registered component validation;
- newer supported-component warnings;
- required, dangling, and wrong-type structured references;
- duplicate object/level/objective/asset IDs and duplicate prefab names;
- invalid registered Mesh, Texture, and Audio metadata;
- unknown asset-type preservation warnings.

It does not inspect arbitrary JavaScript, prose, free-form user text, or unknown component payloads.

## Normalized issue

```json
{
  "severity": "error",
  "code": "dangling-reference",
  "message": "targetId points to missing object \"obj1\".",
  "scope": "structured-reference",
  "levelId": "level1",
  "objectId": "obj2",
  "componentId": null,
  "field": "targetId",
  "referenceType": "object",
  "referenceValue": "obj1",
  "assetId": null
}
```

Severity is exactly `error`, `warning`, or `info`. Missing required/dangling/wrong-type references, invalid metadata, and duplicate prohibited identities are errors. A newer component version or unknown asset type that is safely preserved is a warning. Info is reserved for non-blocking structured observations.

## Editor workflow

Project → Validation → Validate Project runs the full collector manually. Immediate component validation remains local to its Inspector section; the project collector does not run after every keystroke.

The compact result list shows counts and issue messages. Clicking an object issue switches level if needed, selects the object, and opens its Inspector. Asset issues open the Assets tab and scroll to the matching row when present. Unfocusable project-level issues still surface through status text.

Validation is observational: it never silently repairs, clears, or substitutes creator data. A creator repairs the owning field and reruns validation.

