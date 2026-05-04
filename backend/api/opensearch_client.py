"""OpenSearch client factory used by API modules."""

from __future__ import annotations

import os

from opensearchpy import OpenSearch


def get_client() -> OpenSearch:
    host = os.getenv("OPENSEARCH_HOST", "localhost")
    port = int(os.getenv("OPENSEARCH_PORT", "9200"))

    return OpenSearch(
        hosts=[{"host": host, "port": port}],
        use_ssl=False,
        verify_certs=False,
        ssl_assert_hostname=False,
        ssl_show_warn=False,
    )
