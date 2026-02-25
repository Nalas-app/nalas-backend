$env:PGPASSWORD = "123456"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "SELECT version();"
