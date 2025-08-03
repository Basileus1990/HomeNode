package cont

import (
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/config"
)

type Container struct {
	Config config.Config
}

func NewContainer() (Container, error) {
	var container Container

	err := config.LoadConfig()
	if err != nil {
		return container, err
	}
	container.Config = *config.Get()

	return container, nil
}
