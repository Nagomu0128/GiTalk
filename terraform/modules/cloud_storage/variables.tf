variable "bucket_name" {
  type = string
}

variable "location" {
  type = string
}

variable "storage_class" {
  type    = string
  default = "STANDARD"
}

variable "force_destroy" {
  type    = bool
  default = false
}

variable "lifecycle_age_days" {
  type    = number
  default = null
}

variable "cors_origins" {
  type    = list(string)
  default = null
}

variable "iam_members" {
  type = list(object({
    role   = string
    member = string
  }))
  default = []
}
