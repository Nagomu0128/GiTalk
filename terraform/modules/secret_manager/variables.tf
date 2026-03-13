variable "secret_id" {
  type = string
}

variable "secret_data" {
  type      = string
  sensitive = true
  default   = null
}

variable "accessor_members" {
  type    = list(string)
  default = []
}
