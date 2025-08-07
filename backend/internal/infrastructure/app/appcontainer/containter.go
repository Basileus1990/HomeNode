package appcontainer

import (
	"context"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/config"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostmap"
)

type Container struct {
	Config config.Config

	HostConnFactory hostconn.HostConnFactory
	HostMap         hostmap.HostMap
}

func NewContainer(ctx context.Context) (*Container, error) {
	err := config.LoadConfig()
	if err != nil {
		return nil, err
	}
	cfg := config.Get()

	hostConnFactory := &hostconn.DefaultHostConnectionFactory{}
	hostMap := hostmap.NewDefaultHostMap(ctx, hostConnFactory)

	container := Container{
		Config:          *cfg,
		HostConnFactory: hostConnFactory,
		HostMap:         hostMap,
	}
	return &container, nil
}
