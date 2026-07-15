import { expectTypeOf, test } from "vitest";
import { defineComponent, type PropType } from "vue";
import {
  useCopilotAction,
  useCopilotReadable,
  useFrontendTool,
} from "../src";
import type {
  CatchAllFrontendActionRenderProps,
  FrontendActionRenderProps,
  FrontendActionWaitRenderProps,
} from "../src";

test("exports the React-compatible v1 render prop types", () => {
  type CompleteResult = Extract<
    FrontendActionRenderProps,
    { status: "complete" }
  >["result"];
  type WaitResponse = Parameters<
    Extract<FrontendActionWaitRenderProps, { status: "executing" }>["respond"]
  >[0];
  type CatchAllResult = Extract<
    CatchAllFrontendActionRenderProps,
    { status: "complete" }
  >["result"];

  expectTypeOf<CompleteResult>().toBeAny();
  expectTypeOf<WaitResponse>().toBeAny();
  expectTypeOf<CatchAllResult>().toBeAny();
});

test("infers legacy parameter arrays in handlers and render props", () => {
  const parameters: [
    { name: "city"; type: "string" },
    { name: "count"; type: "number" },
  ] = [
    { name: "city", type: "string" },
    { name: "count", type: "number" },
  ];

  useCopilotAction({
    name: "lookup",
    parameters,
    handler: ({ city, count }) => {
      expectTypeOf(city).toBeString();
      expectTypeOf(count).toBeNumber();
      return `${city}:${count}`;
    },
    render: (props: FrontendActionRenderProps<typeof parameters>) => {
      if (props.status === "complete") {
        expectTypeOf(props.args.city).toBeString();
        expectTypeOf(props.args.count).toBeNumber();
        expectTypeOf(props.result).toBeAny();
      }
      return null;
    },
  });

  useFrontendTool({
    name: "lookup",
    parameters,
    handler: ({ city, count }) => `${city}:${count}`,
  });
});

test("accepts correctly typed Vue component renderers", () => {
  type ActionParameters = [
    { name: "city"; type: "string" },
  ];
  type RenderProps = FrontendActionRenderProps<ActionParameters>;
  type WaitProps = FrontendActionWaitRenderProps<ActionParameters>;
  const parameters: ActionParameters = [{ name: "city", type: "string" }];

  const frontendComponent = defineComponent({
    props: {
      args: { type: Object as PropType<RenderProps["args"]>, required: true },
      status: {
        type: String as PropType<RenderProps["status"]>,
        required: true,
      },
      result: { type: null as unknown as PropType<any> },
    },
    setup() {
      return () => null;
    },
  });
  const hitlComponent = defineComponent({
    props: {
      args: { type: Object as PropType<WaitProps["args"]>, required: true },
      status: {
        type: String as PropType<WaitProps["status"]>,
        required: true,
      },
      result: { type: null as unknown as PropType<any> },
      handler: { type: Function as PropType<(result: any) => void> },
      respond: { type: Function as PropType<(result: any) => void> },
    },
    setup() {
      return () => null;
    },
  });

  useCopilotAction({
    name: "component-action",
    available: "enabled",
    parameters,
    render: frontendComponent,
  });
  useCopilotAction({
    name: "component-hitl",
    parameters,
    renderAndWaitForResponse: hitlComponent,
  });
});

test("rejects Vue components with incompatible v1 props", () => {
  type WrongProps = { requiredByAnotherApi: boolean };
  const wrongComponent = defineComponent<WrongProps>(() => () => null);

  useCopilotAction({
    name: "wrong-frontend-component",
    available: "enabled",
    // @ts-expect-error component props must use FrontendActionRenderProps.
    render: wrongComponent,
  });
  useCopilotAction({
    name: "wrong-hitl-component",
    // @ts-expect-error component props must use FrontendActionWaitRenderProps.
    renderAndWaitForResponse: wrongComponent,
  });
});

test("accepts the compatibility fields and rejects non-React v1 fields", () => {
  useCopilotAction({
    name: "legacy-action",
    disabled: true,
    pairedAction: "paired",
    handler: () => "done",
  });
  useCopilotReadable({
    description: "legacy-readable",
    value: {},
    parentId: "parent",
    categories: ["category"],
  });

  useCopilotAction({
    name: "agent-action",
    handler: () => "done",
    // @ts-expect-error agentId is not part of the React v1 contract.
    agentId: "agent",
  });
  useFrontendTool({
    name: "agent-tool",
    handler: () => "done",
    // @ts-expect-error agentId is not part of the React v1 contract.
    agentId: "agent",
  });
  useCopilotAction({
    name: "invalid-hitl",
    renderAndWaitForResponse: () => null,
    // @ts-expect-error HITL actions cannot also provide a handler.
    handler: () => "done",
  });
  // @ts-expect-error availability is a closed compatibility union.
  useCopilotAction({ name: "invalid-availability", available: "server" });
});

test("preserves readable and HITL callback signatures", () => {
  useCopilotReadable({
    description: "legacy-readable",
    value: { city: "Vienna" },
    convert: (description, value) => {
      expectTypeOf(description).toBeString();
      expectTypeOf(value).toEqualTypeOf<unknown>();
      return JSON.stringify(value);
    },
  });

  useCopilotAction({
    name: "wait-for-response",
    renderAndWaitForResponse: (props: FrontendActionWaitRenderProps) => {
      if (props.status === "executing") {
        const response = props.respond("done");
        expectTypeOf(response).toEqualTypeOf<void>();
      }
      return null;
    },
  });
});
