# One-use narrative polish transport

This branch carries a content-addressed archive split into twelve bounded text chunks. The staging workflow verifies both recorded SHA-256 digests, extracts the polished tree, removes this transport directory and its own workflow, runs the complete repository qualification, and only then commits the candidate source.
