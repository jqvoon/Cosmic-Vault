const clientsByUser = new Map();

export const registerFileEventClient = (userId, res) => {
  const key = String(userId);
  const clients = clientsByUser.get(key) ?? new Set();
  clients.add(res);
  clientsByUser.set(key, clients);

  return () => {
    const activeClients = clientsByUser.get(key);
    if (!activeClients) return;

    activeClients.delete(res);
    if (activeClients.size === 0) {
      clientsByUser.delete(key);
    }
  };
};

export const emitFileEvent = (userId, event, payload) => {
  const clients = clientsByUser.get(String(userId));
  const connectedUserCount = clientsByUser.size;
  if (!clients?.size) {
    console.warn(
      `[FileEvents] No clients connected for event=${event}. Total connected users: ${connectedUserCount}`,
    );
    return;
  }

  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  let successCount = 0;
  for (const client of clients) {
    try {
      client.write(message);
      successCount++;
    } catch (err) {
      console.error(
        `[FileEvents] Failed to write to client - event=${event}, error=${err.message}`,
      );
    }
  }
};
