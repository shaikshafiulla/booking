docker run --name meeting-booking-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=meeting_booking \
  -p 5432:5432 \
  -v meeting_booking_data:/var/lib/postgresql/data \
  -d postgres:13