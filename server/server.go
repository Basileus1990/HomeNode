package main

import (
	"github.com/google/uuid"
	"sync"
)

type Server struct {
	hosts          map[uuid.UUID]Host
	hostSharedLock sync.RWMutex
}

func NewServer() *Server {
	return &Server{
		hosts: make(map[uuid.UUID]Host),
	}
}

// AddHost Adds the host to the server and returns its uuid
func (s *Server) AddHost(host Host) uuid.UUID {
	var id uuid.UUID
	s.hostSharedLock.Lock()
	defer s.hostSharedLock.Unlock()

	for {
		id = uuid.New()
		if _, ok := s.hosts[id]; !ok {
			s.hosts[id] = host
			break
		}
	}

	return id
}

// GetHost Returns the host with given uuid. Returns a boolean if the action was a success
func (s *Server) GetHost(id uuid.UUID) (Host, bool) {
	s.hostSharedLock.RLock()
	defer s.hostSharedLock.RUnlock()

	host, ok := s.hosts[id]
	return host, ok
}
