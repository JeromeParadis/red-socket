# Summary

Attempt to write a module that wraps Redis Pub/Sub around socket.io to emit messages to more than one node.js instance


# Installation

Through npm:

    npm install red-socket

Through github:

    git clone git@github.com:JeromeParadis/red-socket.git

# Usage

See [Chat Example](https://github.com/JeromeParadis/red-socket/tree/master/examples/chat)



# TODO:

* Redis Sets store: add volatility and/or keep track per process and delete on process lost
* ... maybe some kind of process ping to keep sets active?
* Add haproxy chat example to show multiple process running
* Add tests
* Add benchmarks
* Documentation
* Clean up code using async

# Disclaimer

* Use at your own risk

# MIT License

Copyright (c) 2011 Jerome Paradis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
