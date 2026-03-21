# Secrets Audit — Pre-Production Checklist

## Must rotate before go-live
- [ ] SECRET_KEY — currently uses dev default in docker-compose.yml
- [ ] DATABASE_URL — change password from default "translation"
- [ ] ANTHROPIC_API_KEY — verify this is the production key
- [ ] VOYAGE_API_KEY — verify this is the production key

## Must configure before go-live
- [ ] STORAGE_BACKEND=s3 + S3_BUCKET_NAME
- [ ] AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (production IAM user, least-privilege)
- [ ] EMAIL_FROM + AWS SES production access

## Infrastructure secrets (managed outside codebase)
- [ ] RDS database password
- [ ] Redis auth token (ElastiCache)
- [ ] SSL certificate (ACM)
- [ ] ALB security group rules

## Notes
- Never commit .env to git — it is in .gitignore
- Rotate all keys if they are ever exposed in logs or error messages
- JWT tokens expire after 7 days — SECRET_KEY rotation invalidates all active sessions
