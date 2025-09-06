package appcontainer

import (
	"context"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/host"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/config"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/client/clientconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostmap"
)

type Container struct {
	Config config.Config

	HostConnFactory hostconn.HostConnFactory
	HostMap         hostmap.HostMap
	HostService     host.HostService

	ClientConnFactory clientconn.ClientConnFactory
}

func NewContainer(ctx context.Context) (*Container, error) {
	err := config.LoadConfig()
	if err != nil {
		return nil, err
	}
	cfg := config.Get()

	hostConnFactory := &hostconn.DefaultHostConnFactory{}
	hostMap := hostmap.NewDefaultHostMap(ctx, hostConnFactory)

	clientConnFactory := &clientconn.DefaultClientConnFactory{}

	hostService := host.NewHostService(hostMap, cfg.Websocket)

	container := Container{
		Config:            *cfg,
		HostConnFactory:   hostConnFactory,
		HostMap:           hostMap,
		HostService:       hostService,
		ClientConnFactory: clientConnFactory,
	}
	return &container, nil
}
