package hostmap

import (
	"context"
	"log"
	"sync"

	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostconn"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type HostMap interface {
	AddNew(conn *websocket.Conn) uuid.UUID
	AddExisting(conn *websocket.Conn, id uuid.UUID, hostKey string) uuid.UUID
	Remove(id uuid.UUID)
	Get(id uuid.UUID) (hostconn.HostConn, bool)
}

// defaultHostMap provides thread-safe storage and management of host connections.
type defaultHostMap struct {
	hosts map[uuid.UUID]hostconn.HostConn
	mu    sync.RWMutex

	ctx             context.Context
	hostConnFactory hostconn.HostConnFactory
}

var _ HostMap = &defaultHostMap{}

func NewDefaultHostMap(ctx context.Context, hostConnFactory hostconn.HostConnFactory) HostMap {
	return &defaultHostMap{
		hosts:           make(map[uuid.UUID]hostconn.HostConn),
		ctx:             ctx,
		hostConnFactory: hostConnFactory,
	}
}

func (h *defaultHostMap) AddNew(conn *websocket.Conn) uuid.UUID {
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

	log.Printf("new host \"%v\" has connected\n", id)
	return id
}

func (h *defaultHostMap) AddExisting(conn *websocket.Conn, id uuid.UUID, hostKey string) uuid.UUID {
	h.mu.Lock()
	defer h.mu.Unlock()

}

func (h *defaultHostMap) Remove(id uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if host, ok := h.hosts[id]; ok {
		host.Close()
	}
	delete(h.hosts, id)
	log.Printf("host \"%v\" has disconnected\n", id)
}

func (h *defaultHostMap) Get(id uuid.UUID) (hostconn.HostConn, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	host, ok := h.hosts[id]
	return host, ok
}

func (h *defaultHostMap) removeWithoutClosing(id uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.hosts, id)
	log.Printf("host \"%v\" has disconnected\n", id)
}
