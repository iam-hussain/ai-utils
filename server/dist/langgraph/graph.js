"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graph = void 0;
const openai_1 = require("@langchain/openai");
const langgraph_1 = require("@langchain/langgraph");
// Initialize the model
const model = new openai_1.ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0,
});
// Define the function that calls the model
async function callModel(state) {
    const messages = state.messages;
    const response = await model.invoke(messages);
    return { messages: [response] };
}
// Define the graph
const workflow = new langgraph_1.StateGraph({
    channels: {
        messages: {
            value: (x, y) => x.concat(y),
            default: () => [],
        },
    },
});
// Add nodes
workflow.addNode("agent", callModel);
// Set entry point
workflow.setEntryPoint("agent");
workflow.addEdge("agent", langgraph_1.END);
// Compile the graph
exports.graph = workflow.compile();
