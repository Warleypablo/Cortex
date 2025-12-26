import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface WonDeal {
  id: number;
  title: string;
  closerName: string;
  opportunity: number;
  stageName: string;
  dateWon: string;
  contractType: string;
}

interface DealNotificationMessage {
  type: "NEW_DEAL_WON";
  data: WonDeal;
  timestamp: string;
}

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

interface UseDealNotificationsOptions {
  enabled?: boolean;
  playSound?: boolean;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.2);

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.warn("[DealNotifications] Could not play notification sound:", error);
  }
};

export function useDealNotifications(options: UseDealNotificationsOptions = {}) {
  const { enabled = true, playSound = true } = options;
  const { toast } = useToast();
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000;

  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(
      baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
      30000
    );
    return delay + Math.random() * 1000;
  }, []);

  const connect = useCallback(() => {
    if (!enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      setConnectionState("connecting");
      
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/deals`;
      
      console.log("[DealNotifications] Connecting to WebSocket:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[DealNotifications] WebSocket connected");
        setConnectionState("connected");
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: DealNotificationMessage = JSON.parse(event.data);
          
          if (message.type === "NEW_DEAL_WON" && message.data) {
            const deal = message.data;
            console.log("[DealNotifications] New deal received:", deal);

            if (playSound) {
              playNotificationSound();
            }

            toast({
              title: "Novo Contrato Fechado!",
              description: `${deal.closerName} fechou ${deal.title} - ${formatCurrency(deal.opportunity)}`,
              duration: 8000,
            });
          }
        } catch (error) {
          console.error("[DealNotifications] Error parsing message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("[DealNotifications] WebSocket error:", error);
        setConnectionState("error");
      };

      ws.onclose = (event) => {
        console.log("[DealNotifications] WebSocket closed:", event.code, event.reason);
        setConnectionState("disconnected");
        wsRef.current = null;

        if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = getReconnectDelay();
          console.log(`[DealNotifications] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.warn("[DealNotifications] Max reconnect attempts reached");
          setConnectionState("error");
        }
      };
    } catch (error) {
      console.error("[DealNotifications] Failed to create WebSocket:", error);
      setConnectionState("error");
    }
  }, [enabled, playSound, toast, getReconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, "Client disconnecting");
      wsRef.current = null;
    }
    
    reconnectAttemptsRef.current = 0;
    setConnectionState("disconnected");
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    connectionState,
    isConnected: connectionState === "connected",
    reconnect: connect,
  };
}
