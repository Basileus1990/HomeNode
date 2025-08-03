package controllers

import "github.com/gin-gonic/gin"

type Controller interface {
	SetUpRoutes(group *gin.RouterGroup)
}
