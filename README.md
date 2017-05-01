# test_request.js

A simple script to send requests to URLs and see the response in the command line

## Flags

`-u`: the url to test (must include http/s://) **(required)**\n
`-t`: the timeout value of the request (defaults to 10000ms)\n
`-m`: if included will try to handle cases where a CN mismatch is occurring due to a missing/included `www.`\n
`-r`: the number of redirects to follow (defaults to 5)\n

## Usage example

`node test_request.js -u http://www.google.com -t 5000 -r 3`\n
`node test_request.js -u https://slack.com -m`
