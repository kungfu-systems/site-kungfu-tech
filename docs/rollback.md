# Rollback

Rollback for the current production site is S3 object-version based:

1. Restore the previous `index.html` object version in
   `kungfu-tech-site-727884401362-us-east-1`.
2. Restore the previous `.well-known/security.txt` object version if needed.
3. Create a CloudFront invalidation for `/`, `/index.html`, and
   `/.well-known/security.txt`.
4. Verify `https://kungfu.tech`, `https://www.kungfu.tech`, and
   `https://kungfu.tech/.well-known/security.txt`.

Do not change DNS, ACM, CloudFront aliases, or bucket policy for a content-only
rollback.

