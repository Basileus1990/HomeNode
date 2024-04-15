package main

import (
	"sync"

	"github.com/google/uuid"
)

type Server struct {
	hosts          map[uuid.UUID]Host
	users          map[uuid.UUID]User
	hostSharedLock sync.RWMutex
	userSharedLock sync.RWMutex
}

func NewServer() *Server {
	return &Server{
		hosts: make(map[uuid.UUID]Host),
		users: make(map[uuid.UUID]User),
	}
}

// AddHost adds the host to the server and returns its uuid
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

// AddUser adds the user to the server and returns its uuid
func (s *Server) AddUser(user User) uuid.UUID {
	var id uuid.UUID
	s.userSharedLock.Lock()
	defer s.userSharedLock.Unlock()

	for {
		id = uuid.New()
		if _, ok := s.users[id]; !ok {
			s.users[id] = user
			break
		}
	}

	return id
}

// RemoveHost removes host with given uuid from the map. If such host does not exist it does nothing
func (s *Server) RemoveHost(id uuid.UUID) {
	s.hostSharedLock.Lock()
	defer s.hostSharedLock.Unlock()

	delete(s.hosts, id)
}

// RemoveUser removes user with given uuid from the map. If such user does not exist it does nothing
func (s *Server) RemoveUser(id uuid.UUID) {
	s.userSharedLock.Lock()
	defer s.userSharedLock.Unlock()

	delete(s.users, id)
}

// GetHost returns the host with given uuid. Returns a boolean if the action was a success
func (s *Server) GetHost(id uuid.UUID) (Host, bool) {
	s.hostSharedLock.RLock()
	defer s.hostSharedLock.RUnlock()

	host, ok := s.hosts[id]
	return host, ok
}

// GetUser returns the user with given uuid. Returns a boolean if the action was a success
func (s *Server) GetUser(id uuid.UUID) (User, bool) {
	s.userSharedLock.RLock()
	defer s.userSharedLock.RUnlock()

	user, ok := s.users[id]
	return user, ok
}
