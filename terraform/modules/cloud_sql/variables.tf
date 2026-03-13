variable "instance_name" {
  type = string
}

variable "region" {
  type = string
}

variable "database_version" {
  type    = string
  default = "POSTGRES_15"
}

variable "tier" {
  type    = string
  default = "db-f1-micro"
}

variable "disk_size_gb" {
  type    = number
  default = 10
}

variable "enable_public_ip" {
  type    = bool
  default = false
}

variable "authorized_networks" {
  type = list(object({
    name = string
    cidr = string
  }))
  default = []
}

variable "enable_backup" {
  type    = bool
  default = false
}

variable "deletion_protection" {
  type    = bool
  default = true
}

variable "database_name" {
  type = string
}

variable "user_name" {
  type    = string
  default = null
}

variable "user_password" {
  type      = string
  sensitive = true
  default   = null
}
