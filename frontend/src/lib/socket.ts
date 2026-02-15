import { io } from 'socket.io-client'
import { apiConfig } from './api'

const socketUrl = apiConfig.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3005')

export const socket = io(socketUrl, {
  autoConnect: false,
  withCredentials: true,
})
