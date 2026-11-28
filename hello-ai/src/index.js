import { serveChatBot } from './chat/handler.js';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname.startsWith('/chat')) {
            return serveChatBot(request, env);
        }

        return env.ASSETS.fetch(request);
    }
};
