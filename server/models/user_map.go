package models

import (
	"sync"

	"github.com/google/uuid"
)

type UserMap struct {
	hosts          map[uuid.UUID]User
	hostSharedLock sync.RWMutex
}

func NewUserMap() *UserMap {
	return &UserMap{
		hosts: make(map[uuid.UUID]User),
	}
}

// Add adds the user to the server and returns its uuid
func (u *UserMap) Add(user User) uuid.UUID {
	var id uuid.UUID
	u.hostSharedLock.Lock()
	defer u.hostSharedLock.Unlock()

	for {
		id = uuid.New()
		if _, ok := u.hosts[id]; !ok {
			u.hosts[id] = user
			break
		}
	}

	return id
}

// Remove removes user with given uuid from the map. If such user does not exist it does nothing
func (u *UserMap) Remove(id uuid.UUID) {
	u.hostSharedLock.Lock()
	defer u.hostSharedLock.Unlock()

	delete(u.hosts, id)
}

// Get returns the user with given uuid. Returns a boolean which indicates if the action was a success
func (u *UserMap) Get(id uuid.UUID) (User, bool) {
	u.hostSharedLock.RLock()
	defer u.hostSharedLock.RUnlock()

	host, ok := u.hosts[id]
	return host, ok
}
