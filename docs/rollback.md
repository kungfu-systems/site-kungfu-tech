# Rollback

Rollback for the current production site is S3 object-version based:

1. Restore the previous deployment manifest recorded by Buildchain. Use its
   object inventory rather than restoring only the homepage.
2. Restore the previous object versions for changed paths, including
   `/whitepaper/**` and `/assets/whitepaper.css` when the release changed the
   white paper surface.
3. Restore the previous `.well-known/security.txt` object version if needed.
4. Create a CloudFront invalidation for the restored paths. Include
   `/whitepaper/*` when rolling back a white paper release.
5. Verify `https://kungfu.tech`, `https://www.kungfu.tech`, the white paper HTML,
   PDF and machine entry routes, and `https://kungfu.tech/.well-known/security.txt`.

Do not change DNS, ACM, CloudFront aliases, or bucket policy for a content-only
rollback.
