// Scope regression fixture: this file is outside opencode/plugins/arggon and
// must not be interpreted as a native Arggon registration surface.
export function nonPlugin(router: Router, editor: Editor, definitions: Definition[]) {
  register(router);
  install(router);
  configure(router);
  editor.add(doc);
  editor.namespace({ name: "app", description: "Application namespace" });
  for (const definition of definitions) {
    consume(definition);
  }
  return <div>non-plugin</div>;
}
