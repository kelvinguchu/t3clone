import mitt from "mitt";

export type ChatEvents = {
  flushRequest: undefined;
  flushComplete: undefined;
};

export const chatBus = mitt<ChatEvents>();
