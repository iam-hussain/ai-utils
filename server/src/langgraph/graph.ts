import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import { StateGraph, StateGraphArgs, END } from "@langchain/langgraph";

// Define the state interface
interface AgentState {
    messages: BaseMessage[];
}

// Initialize the model
const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0,
});

// Define the function that calls the model
async function callModel(state: AgentState) {
    const messages = state.messages;
    const response = await model.invoke(messages);
    return { messages: [response] };
}

// Define the graph
const workflow = new StateGraph<AgentState>({
    channels: {
        messages: {
            value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
            default: () => [],
        },
    },
});

// Add nodes
workflow.addNode("agent", callModel);

// Set entry point
workflow.setEntryPoint("agent");
workflow.addEdge("agent", END);

// Compile the graph
export const graph = workflow.compile();
