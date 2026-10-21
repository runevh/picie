# Photo storage

Uploads convert and encrypt before creating a durable cleanup record. Files are
staged under the generated photo UUID, then published inside the database
transaction that creates the photo. Readers only see photos after both assets
exist. A failed or interrupted operation retains a `PhotoOperation` row until
its files are cleaned up. Workers and recovery lock the same row, preventing
recovery from deleting an active upload's files.

Deletion removes library entries and affected device selections in one transaction
with its cleanup record. File failures return 503 with an explicit pending-cleanup
message. Cleanup retries every scheduler tick (one minute), including after a
restart, and before the owner's next deletion request. Missing files are harmless;
other filesystem errors retain the record. Do not manually delete cleanup rows.

The default directory remains `backend/photos`. `PHOTO_STORAGE_PATH` can override
it for isolated environments and must be shared by all backend instances. Both
staging and published assets live on that filesystem. The database and photo
volume must be backed up together; this does not make separate storage systems
atomic under hardware failure or recover old orphans created before this change.

Run `npm test -- --runInBand`. The photo storage suite uses a temporary directory
and injects write, rename, encryption, database, and deletion failures.
