import { io } from 'socket.io-client';

// In production, this should point to the actual server URL
// In development with Vite proxy, it can be just "/" or "http://localhost:3000"
const URL = import.meta.env.PROD ? '/' : 'http://localhost:3000';

export const socket = io(URL, {
    autoConnect: false,
});
