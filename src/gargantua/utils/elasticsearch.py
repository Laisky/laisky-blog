import json


def parse_search_resp(resp):
    return [i['_source'] for i in json.loads(resp)['hits']['hits']]


def generate_keyword_search(keyword, field='post_content'):
    query = {
        "query": {
            "match": {
                field: keyword
            }
        }
    }
    return json.dumps(query)
