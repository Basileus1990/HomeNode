package main

import (
	"sync"

	"github.com/google/uuid"
)

type HostMap struct {
	hosts          map[uuid.UUID]Host
	hostSharedLock sync.RWMutex
}

func NewHostMap() *HostMap {
	return &HostMap{
		hosts: make(map[uuid.UUID]Host),
	}
}

// Add adds the host to the server and returns its uuid
func (h *HostMap) Add(host Host) uuid.UUID {
	var id uuid.UUID
	h.hostSharedLock.Lock()
	defer h.hostSharedLock.Unlock()

	for {
		id = uuid.New()
		if _, ok := h.hosts[id]; !ok {
			h.hosts[id] = host
			break
		}
	}

	return id
}

// Remove removes host with given uuid from the map. If such host does not exist it does nothing
func (h *HostMap) Remove(id uuid.UUID) {
	h.hostSharedLock.Lock()
	defer h.hostSharedLock.Unlock()

	delete(h.hosts, id)
}

// Get returns the host with given uuid. Returns a boolean if the action was a success
func (h *HostMap) Get(id uuid.UUID) (Host, bool) {
	h.hostSharedLock.RLock()
	defer h.hostSharedLock.RUnlock()

	host, ok := h.hosts[id]
	return host, ok
}

type Host struct {
}
