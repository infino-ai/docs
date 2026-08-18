// Third-party packages the examples import to illustrate a workflow, declared
// loosely rather than installed: the check exists to catch drift in Infino's own
// API, and pulling a full embedding runtime in for its types would dominate the
// install for no added signal.
declare module "@huggingface/transformers" {
  export function pipeline(task: string, model?: string): Promise<any>;
}

declare module "openai" {
  const OpenAI: any;
  export default OpenAI;
}
