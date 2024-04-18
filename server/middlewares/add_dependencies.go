package middlewares

import (
	"context"
	"net/http"
)

// DependencyInjector is a middleware which inserts the dependencies into the request context
type DependencyInjector struct {
	handler      http.Handler
	dependencies map[string]any
}

func (di *DependencyInjector) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	for k, v := range di.dependencies {
		ctx = context.WithValue(ctx, k, v)
	}
	r = r.WithContext(ctx)

	di.handler.ServeHTTP(w, r)
}

// NewDependencyInjector creates new dependency injector middleware to inject the dependencies
func NewDependencyInjector(toBeWrapped http.Handler, dependencies map[string]any) *DependencyInjector {
	return &DependencyInjector{
		handler:      toBeWrapped,
		dependencies: dependencies,
	}
}
