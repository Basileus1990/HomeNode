package hostmap

import (
	"context"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostconn"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type HostMap interface {
	Add(conn *websocket.Conn) uuid.UUID
	Remove(id uuid.UUID)
	Get(id uuid.UUID) (hostconn.Conn, bool)
}

// defaultHostMap provides thread-safe storage and management of host connections.
type defaultHostMap struct {
	hosts map[uuid.UUID]hostconn.Conn
	mu    sync.RWMutex

	ctx             context.Context
	hostConnFactory hostconn.HostConnFactory
}

var _ HostMap = &defaultHostMap{}

func NewDefaultHostMap(ctx context.Context, hostConnFactory hostconn.HostConnFactory) HostMap {
	return &defaultHostMap{
		hosts:           make(map[uuid.UUID]hostconn.Conn),
		ctx:             ctx,
		hostConnFactory: hostConnFactory,
	}
}

func (h *defaultHostMap) Add(conn *websocket.Conn) uuid.UUID {
	h.mu.Lock()
	defer h.mu.Unlock()

	var id uuid.UUID
	for {
		id = uuid.New()
		if _, ok := h.hosts[id]; !ok {
			break
		}
	}

	hostConn := h.hostConnFactory.NewHostConn(h.ctx, conn, func() {
		h.removeWithoutClosing(id)
	})
	h.hosts[id] = hostConn

	return id
}

func (h *defaultHostMap) Remove(id uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if host, ok := h.hosts[id]; ok {
		host.Close()
	}
	delete(h.hosts, id)
}

func (h *defaultHostMap) Get(id uuid.UUID) (hostconn.Conn, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	host, ok := h.hosts[id]
	return host, ok
}

func (h *defaultHostMap) removeWithoutClosing(id uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.hosts, id)
}
