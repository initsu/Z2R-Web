// src/driver/codec/codec.ts
var codec;
function setGzipCodec(c) {
  codec = c;
}
function gzipCodec() {
  return codec;
}

// node_modules/.bun/pako@3.0.1/node_modules/pako/dist/pako.mjs
var Z_FIXED = 4;
var Z_BINARY = 0;
var Z_TEXT = 1;
var Z_UNKNOWN = 2;
function zero$1(buf) {
  let len = buf.length;
  while (--len >= 0)
    buf[len] = 0;
}
var STORED_BLOCK = 0;
var STATIC_TREES = 1;
var DYN_TREES = 2;
var LENGTH_CODES = 29;
var LITERALS = 256;
var L_CODES = 286;
var D_CODES = 30;
var BL_CODES = 19;
var HEAP_SIZE$1 = 573;
var MAX_BITS = 15;
var Buf_size = 16;
var MAX_BL_BITS = 7;
var END_BLOCK = 256;
var REP_3_6 = 16;
var REPZ_3_10 = 17;
var REPZ_11_138 = 18;
var extra_lbits = new Uint8Array([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0
]);
var extra_dbits = new Uint8Array([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13
]);
var extra_blbits = new Uint8Array([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  2,
  3,
  7
]);
var bl_order = new Uint8Array([
  16,
  17,
  18,
  0,
  8,
  7,
  9,
  6,
  10,
  5,
  11,
  4,
  12,
  3,
  13,
  2,
  14,
  1,
  15
]);
var DIST_CODE_LEN = 512;
var static_ltree = new Array(288 * 2);
zero$1(static_ltree);
var static_dtree = new Array(D_CODES * 2);
zero$1(static_dtree);
var _dist_code = new Array(DIST_CODE_LEN);
zero$1(_dist_code);
var _length_code = new Array(256);
zero$1(_length_code);
var base_length = new Array(LENGTH_CODES);
zero$1(base_length);
var base_dist = new Array(D_CODES);
zero$1(base_dist);
var StaticTreeDesc = class {
  constructor(static_tree, extra_bits, extra_base, elems, max_length) {
    this.static_tree = static_tree;
    this.extra_bits = extra_bits;
    this.extra_base = extra_base;
    this.elems = elems;
    this.max_length = max_length;
    this.has_stree = static_tree && static_tree.length;
  }
};
var static_l_desc;
var static_d_desc;
var static_bl_desc;
var TreeDesc = class {
  constructor(dyn_tree, stat_desc) {
    this.dyn_tree = dyn_tree;
    this.max_code = 0;
    this.stat_desc = stat_desc;
  }
};
var d_code = (dist) => {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
};
var put_short = (s, w) => {
  s.pending_buf[s.pending++] = w & 255;
  s.pending_buf[s.pending++] = w >>> 8 & 255;
};
var send_bits = (s, value, length) => {
  if (s.bi_valid > Buf_size - length) {
    s.bi_buf |= value << s.bi_valid & 65535;
    put_short(s, s.bi_buf);
    s.bi_buf = value >> Buf_size - s.bi_valid;
    s.bi_valid += length - Buf_size;
  } else {
    s.bi_buf |= value << s.bi_valid & 65535;
    s.bi_valid += length;
  }
};
var send_code = (s, c, tree) => {
  send_bits(s, tree[c * 2], tree[c * 2 + 1]);
};
var bi_reverse = (code, len) => {
  let res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
};
var bi_flush = (s) => {
  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;
  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 255;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
};
var gen_bitlen = (s, desc) => {
  const tree = desc.dyn_tree;
  const max_code = desc.max_code;
  const stree = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const extra = desc.stat_desc.extra_bits;
  const base = desc.stat_desc.extra_base;
  const max_length = desc.stat_desc.max_length;
  let h;
  let n, m;
  let bits;
  let xbits;
  let f;
  let overflow = 0;
  for (bits = 0;bits <= MAX_BITS; bits++)
    s.bl_count[bits] = 0;
  tree[s.heap[s.heap_max] * 2 + 1] = 0;
  for (h = s.heap_max + 1;h < HEAP_SIZE$1; h++) {
    n = s.heap[h];
    bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n * 2 + 1] = bits;
    if (n > max_code)
      continue;
    s.bl_count[bits]++;
    xbits = 0;
    if (n >= base)
      xbits = extra[n - base];
    f = tree[n * 2];
    s.opt_len += f * (bits + xbits);
    if (has_stree)
      s.static_len += f * (stree[n * 2 + 1] + xbits);
  }
  if (overflow === 0)
    return;
  do {
    bits = max_length - 1;
    while (s.bl_count[bits] === 0)
      bits--;
    s.bl_count[bits]--;
    s.bl_count[bits + 1] += 2;
    s.bl_count[max_length]--;
    overflow -= 2;
  } while (overflow > 0);
  for (bits = max_length;bits !== 0; bits--) {
    n = s.bl_count[bits];
    while (n !== 0) {
      m = s.heap[--h];
      if (m > max_code)
        continue;
      if (tree[m * 2 + 1] !== bits) {
        s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
        tree[m * 2 + 1] = bits;
      }
      n--;
    }
  }
};
var gen_codes = (tree, max_code, bl_count) => {
  const next_code = new Array(16);
  let code = 0;
  let bits;
  let n;
  for (bits = 1;bits <= MAX_BITS; bits++) {
    code = code + bl_count[bits - 1] << 1;
    next_code[bits] = code;
  }
  for (n = 0;n <= max_code; n++) {
    let len = tree[n * 2 + 1];
    if (len === 0)
      continue;
    tree[n * 2] = bi_reverse(next_code[len]++, len);
  }
};
var tr_static_init = () => {
  let n;
  let bits;
  let length;
  let code;
  let dist;
  const bl_count = new Array(16);
  length = 0;
  for (code = 0;code < LENGTH_CODES - 1; code++) {
    base_length[code] = length;
    for (n = 0;n < 1 << extra_lbits[code]; n++)
      _length_code[length++] = code;
  }
  _length_code[length - 1] = code;
  dist = 0;
  for (code = 0;code < 16; code++) {
    base_dist[code] = dist;
    for (n = 0;n < 1 << extra_dbits[code]; n++)
      _dist_code[dist++] = code;
  }
  dist >>= 7;
  for (;code < D_CODES; code++) {
    base_dist[code] = dist << 7;
    for (n = 0;n < 1 << extra_dbits[code] - 7; n++)
      _dist_code[256 + dist++] = code;
  }
  for (bits = 0;bits <= MAX_BITS; bits++)
    bl_count[bits] = 0;
  n = 0;
  while (n <= 143) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree[n * 2 + 1] = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree[n * 2 + 1] = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  gen_codes(static_ltree, 287, bl_count);
  for (n = 0;n < D_CODES; n++) {
    static_dtree[n * 2 + 1] = 5;
    static_dtree[n * 2] = bi_reverse(n, 5);
  }
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, 257, L_CODES, MAX_BITS);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES, MAX_BITS);
  static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES, MAX_BL_BITS);
};
var init_block = (s) => {
  let n;
  for (n = 0;n < L_CODES; n++)
    s.dyn_ltree[n * 2] = 0;
  for (n = 0;n < D_CODES; n++)
    s.dyn_dtree[n * 2] = 0;
  for (n = 0;n < BL_CODES; n++)
    s.bl_tree[n * 2] = 0;
  s.dyn_ltree[END_BLOCK * 2] = 1;
  s.opt_len = s.static_len = 0;
  s.sym_next = s.matches = 0;
};
var bi_windup = (s) => {
  if (s.bi_valid > 8)
    put_short(s, s.bi_buf);
  else if (s.bi_valid > 0)
    s.pending_buf[s.pending++] = s.bi_buf;
  s.bi_buf = 0;
  s.bi_valid = 0;
};
var smaller = (tree, n, m, depth) => {
  const _n2 = n * 2;
  const _m2 = m * 2;
  return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
};
var pqdownheap = (s, tree, k) => {
  const v = s.heap[k];
  let j = k << 1;
  while (j <= s.heap_len) {
    if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth))
      j++;
    if (smaller(tree, v, s.heap[j], s.depth))
      break;
    s.heap[k] = s.heap[j];
    k = j;
    j <<= 1;
  }
  s.heap[k] = v;
};
var compress_block = (s, ltree, dtree) => {
  let dist;
  let lc;
  let sx = 0;
  let code;
  let extra;
  if (s.sym_next !== 0)
    do {
      dist = s.pending_buf[s.sym_buf + sx++] & 255;
      dist += (s.pending_buf[s.sym_buf + sx++] & 255) << 8;
      lc = s.pending_buf[s.sym_buf + sx++];
      if (dist === 0)
        send_code(s, lc, ltree);
      else {
        code = _length_code[lc];
        send_code(s, code + LITERALS + 1, ltree);
        extra = extra_lbits[code];
        if (extra !== 0) {
          lc -= base_length[code];
          send_bits(s, lc, extra);
        }
        dist--;
        code = d_code(dist);
        send_code(s, code, dtree);
        extra = extra_dbits[code];
        if (extra !== 0) {
          dist -= base_dist[code];
          send_bits(s, dist, extra);
        }
      }
    } while (sx < s.sym_next);
  send_code(s, END_BLOCK, ltree);
};
var build_tree = (s, desc) => {
  const tree = desc.dyn_tree;
  const stree = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const elems = desc.stat_desc.elems;
  let n, m;
  let max_code = -1;
  let node;
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE$1;
  for (n = 0;n < elems; n++)
    if (tree[n * 2] !== 0) {
      s.heap[++s.heap_len] = max_code = n;
      s.depth[n] = 0;
    } else
      tree[n * 2 + 1] = 0;
  while (s.heap_len < 2) {
    node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
    tree[node * 2] = 1;
    s.depth[node] = 0;
    s.opt_len--;
    if (has_stree)
      s.static_len -= stree[node * 2 + 1];
  }
  desc.max_code = max_code;
  for (n = s.heap_len >> 1;n >= 1; n--)
    pqdownheap(s, tree, n);
  node = elems;
  do {
    n = s.heap[1];
    s.heap[1] = s.heap[s.heap_len--];
    pqdownheap(s, tree, 1);
    m = s.heap[1];
    s.heap[--s.heap_max] = n;
    s.heap[--s.heap_max] = m;
    tree[node * 2] = tree[n * 2] + tree[m * 2];
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n * 2 + 1] = tree[m * 2 + 1] = node;
    s.heap[1] = node++;
    pqdownheap(s, tree, 1);
  } while (s.heap_len >= 2);
  s.heap[--s.heap_max] = s.heap[1];
  gen_bitlen(s, desc);
  gen_codes(tree, max_code, s.bl_count);
};
var scan_tree = (s, tree, max_code) => {
  let n;
  let prevlen = -1;
  let curlen;
  let nextlen = tree[1];
  let count = 0;
  let max_count = 7;
  let min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code + 1) * 2 + 1] = 65535;
  for (n = 0;n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen)
      continue;
    else if (count < min_count)
      s.bl_tree[curlen * 2] += count;
    else if (curlen !== 0) {
      if (curlen !== prevlen)
        s.bl_tree[curlen * 2]++;
      s.bl_tree[REP_3_6 * 2]++;
    } else if (count <= 10)
      s.bl_tree[REPZ_3_10 * 2]++;
    else
      s.bl_tree[REPZ_11_138 * 2]++;
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};
var send_tree = (s, tree, max_code) => {
  let n;
  let prevlen = -1;
  let curlen;
  let nextlen = tree[1];
  let count = 0;
  let max_count = 7;
  let min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  for (n = 0;n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen)
      continue;
    else if (count < min_count)
      do
        send_code(s, curlen, s.bl_tree);
      while (--count !== 0);
    else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree);
        count--;
      }
      send_code(s, REP_3_6, s.bl_tree);
      send_bits(s, count - 3, 2);
    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree);
      send_bits(s, count - 3, 3);
    } else {
      send_code(s, REPZ_11_138, s.bl_tree);
      send_bits(s, count - 11, 7);
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};
var build_bl_tree = (s) => {
  let max_blindex;
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
  build_tree(s, s.bl_desc);
  for (max_blindex = BL_CODES - 1;max_blindex >= 3; max_blindex--)
    if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0)
      break;
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  return max_blindex;
};
var send_all_trees = (s, lcodes, dcodes, blcodes) => {
  let rank;
  send_bits(s, lcodes - 257, 5);
  send_bits(s, dcodes - 1, 5);
  send_bits(s, blcodes - 4, 4);
  for (rank = 0;rank < blcodes; rank++)
    send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1], 3);
  send_tree(s, s.dyn_ltree, lcodes - 1);
  send_tree(s, s.dyn_dtree, dcodes - 1);
};
var detect_data_type = (s) => {
  let block_mask = 4093624447;
  let n;
  for (n = 0;n <= 31; n++, block_mask >>>= 1)
    if (block_mask & 1 && s.dyn_ltree[n * 2] !== 0)
      return Z_BINARY;
  if (s.dyn_ltree[18] !== 0 || s.dyn_ltree[20] !== 0 || s.dyn_ltree[26] !== 0)
    return Z_TEXT;
  for (n = 32;n < LITERALS; n++)
    if (s.dyn_ltree[n * 2] !== 0)
      return Z_TEXT;
  return Z_BINARY;
};
var static_init_done = false;
var _tr_init = (s) => {
  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }
  s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
  s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
  s.bi_buf = 0;
  s.bi_valid = 0;
  init_block(s);
};
var _tr_stored_block = (s, buf, stored_len, last) => {
  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
  bi_windup(s);
  put_short(s, stored_len);
  put_short(s, ~stored_len);
  if (stored_len)
    s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending);
  s.pending += stored_len;
};
var _tr_align = (s) => {
  send_bits(s, STATIC_TREES << 1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
};
var _tr_flush_block = (s, buf, stored_len, last) => {
  let opt_lenb, static_lenb;
  let max_blindex = 0;
  if (s.level > 0) {
    if (s.strm.data_type === Z_UNKNOWN)
      s.strm.data_type = detect_data_type(s);
    build_tree(s, s.l_desc);
    build_tree(s, s.d_desc);
    max_blindex = build_bl_tree(s);
    opt_lenb = s.opt_len + 3 + 7 >>> 3;
    static_lenb = s.static_len + 3 + 7 >>> 3;
    if (static_lenb <= opt_lenb)
      opt_lenb = static_lenb;
  } else
    opt_lenb = static_lenb = stored_len + 5;
  if (stored_len + 4 <= opt_lenb && buf !== -1)
    _tr_stored_block(s, buf, stored_len, last);
  else if (s.strategy === Z_FIXED || static_lenb === opt_lenb) {
    send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
    compress_block(s, static_ltree, static_dtree);
  } else {
    send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
    send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
    compress_block(s, s.dyn_ltree, s.dyn_dtree);
  }
  init_block(s);
  if (last)
    bi_windup(s);
};
var _tr_tally = (s, dist, lc) => {
  s.pending_buf[s.sym_buf + s.sym_next++] = dist;
  s.pending_buf[s.sym_buf + s.sym_next++] = dist >> 8;
  s.pending_buf[s.sym_buf + s.sym_next++] = lc;
  if (dist === 0)
    s.dyn_ltree[lc * 2]++;
  else {
    s.matches++;
    dist--;
    s.dyn_ltree[(_length_code[lc] + LITERALS + 1) * 2]++;
    s.dyn_dtree[d_code(dist) * 2]++;
  }
  return s.sym_next === s.sym_end;
};
var adler32 = (adler, buf, len, pos) => {
  let s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n = 0;
  while (len !== 0) {
    n = len > 2000 ? 2000 : len;
    len -= n;
    do {
      s1 = s1 + buf[pos++] | 0;
      s2 = s2 + s1 | 0;
    } while (--n);
    s1 %= 65521;
    s2 %= 65521;
  }
  return s1 | s2 << 16 | 0;
};
var makeTable = () => {
  let c, table = [];
  for (var n = 0;n < 256; n++) {
    c = n;
    for (var k = 0;k < 8; k++)
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    table[n] = c;
  }
  return table;
};
var crcTable = new Uint32Array(makeTable());
var crc32 = (crc, buf, len, pos) => {
  const t = crcTable;
  const end = pos + len;
  crc ^= -1;
  for (let i = pos;i < end; i++)
    crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
  return crc ^ -1;
};
var messages_default = {
  2: "need dictionary",
  1: "stream end",
  0: "",
  "-1": "file error",
  "-2": "stream error",
  "-3": "data error",
  "-4": "insufficient memory",
  "-5": "buffer error",
  "-6": "incompatible version"
};
var MAX_MEM_LEVEL = 9;
var HEAP_SIZE = 573;
var MIN_MATCH = 3;
var MAX_MATCH = 258;
var MIN_LOOKAHEAD = 262;
var PRESET_DICT = 32;
var INIT_STATE = 42;
var GZIP_STATE = 57;
var EXTRA_STATE = 69;
var NAME_STATE = 73;
var COMMENT_STATE = 91;
var HCRC_STATE = 103;
var BUSY_STATE = 113;
var FINISH_STATE = 666;
var BS_NEED_MORE = 1;
var BS_BLOCK_DONE = 2;
var BS_FINISH_STARTED = 3;
var BS_FINISH_DONE = 4;
var OS_CODE = 3;
var err = (strm, errorCode) => {
  strm.msg = messages_default[errorCode];
  return errorCode;
};
var rank = (f) => {
  return f * 2 - (f > 4 ? 9 : 0);
};
var zero = (buf) => {
  let len = buf.length;
  while (--len >= 0)
    buf[len] = 0;
};
var slide_hash = (s) => {
  let n, m;
  let p;
  let wsize = s.w_size;
  n = s.hash_size;
  p = n;
  do {
    m = s.head[--p];
    s.head[p] = m >= wsize ? m - wsize : 0;
  } while (--n);
  n = wsize;
  p = n;
  do {
    m = s.prev[--p];
    s.prev[p] = m >= wsize ? m - wsize : 0;
  } while (--n);
};
var HASH = (s, prev, data) => (prev << s.hash_shift ^ data) & s.hash_mask;
var INSERT_STRING = (s, str) => {
  let h;
  if (s.legacy_hash)
    h = s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
  else {
    const w = s.window;
    const value = w[str] | w[str + 1] << 8 | w[str + 2] << 16 | w[str + 3] << 24;
    h = s.ins_h = Math.imul(value, 66521) + 66521 >>> 16 & s.hash_mask;
  }
  const hash_head = s.prev[str & s.w_mask] = s.head[h];
  s.head[h] = str;
  return hash_head;
};
var flush_pending = (strm) => {
  const s = strm.state;
  let len = s.pending;
  if (len > strm.avail_out)
    len = strm.avail_out;
  if (len === 0)
    return;
  strm.output.set(s.pending_buf.subarray(s.pending_out, s.pending_out + len), strm.next_out);
  strm.next_out += len;
  s.pending_out += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s.pending -= len;
  if (s.pending === 0)
    s.pending_out = 0;
};
var flush_block_only = (s, last) => {
  _tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
};
var put_byte = (s, b) => {
  s.pending_buf[s.pending++] = b;
};
var putShortMSB = (s, b) => {
  s.pending_buf[s.pending++] = b >>> 8 & 255;
  s.pending_buf[s.pending++] = b & 255;
};
var read_buf = (strm, buf, start, size) => {
  let len = strm.avail_in;
  if (len > size)
    len = size;
  if (len === 0)
    return 0;
  strm.avail_in -= len;
  buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start);
  if (strm.state.wrap === 1)
    strm.adler = adler32(strm.adler, buf, len, start);
  else if (strm.state.wrap === 2)
    strm.adler = crc32(strm.adler, buf, len, start);
  strm.next_in += len;
  strm.total_in += len;
  return len;
};
var longest_match = (s, cur_match) => {
  let chain_length = s.max_chain_length;
  let scan = s.strstart;
  let match;
  let len;
  let best_len = s.prev_length;
  let nice_match = s.nice_match;
  const limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
  const _win = s.window;
  const wmask = s.w_mask;
  const prev = s.prev;
  const strend = s.strstart + MAX_MATCH;
  let scan_end1 = _win[scan + best_len - 1];
  let scan_end = _win[scan + best_len];
  if (s.prev_length >= s.good_match)
    chain_length >>= 2;
  if (nice_match > s.lookahead)
    nice_match = s.lookahead;
  do {
    match = cur_match;
    if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1])
      continue;
    scan += 2;
    match++;
    do
      ;
    while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
    len = MAX_MATCH - (strend - scan);
    scan = strend - MAX_MATCH;
    if (len > best_len) {
      s.match_start = cur_match;
      best_len = len;
      if (len >= nice_match)
        break;
      scan_end1 = _win[scan + best_len - 1];
      scan_end = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
  if (best_len <= s.lookahead)
    return best_len;
  return s.lookahead;
};
var fill_window = (s) => {
  const _w_size = s.w_size;
  let n, more, str;
  do {
    more = s.window_size - s.lookahead - s.strstart;
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
      s.window.set(s.window.subarray(_w_size, _w_size + _w_size - more), 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      s.block_start -= _w_size;
      if (s.insert > s.strstart)
        s.insert = s.strstart;
      slide_hash(s);
      more += _w_size;
    }
    if (s.strm.avail_in === 0)
      break;
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;
    if (!s.legacy_hash) {
      if (s.lookahead + s.insert > MIN_MATCH) {
        str = s.strstart - s.insert;
        while (s.insert) {
          INSERT_STRING(s, str);
          str++;
          s.insert--;
          if (s.lookahead + s.insert <= MIN_MATCH)
            break;
        }
      }
    } else if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];
      s.ins_h = HASH(s, s.ins_h, s.window[str + 1]);
      while (s.insert) {
        INSERT_STRING(s, str);
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH)
          break;
      }
    }
  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
};
var deflate_stored = (s, flush) => {
  let min_block = s.pending_buf_size - 5 > s.w_size ? s.w_size : s.pending_buf_size - 5;
  let len, left, have, last = 0;
  let used = s.strm.avail_in;
  do {
    len = 65535;
    have = s.bi_valid + 42 >> 3;
    if (s.strm.avail_out < have)
      break;
    have = s.strm.avail_out - have;
    left = s.strstart - s.block_start;
    if (len > left + s.strm.avail_in)
      len = left + s.strm.avail_in;
    if (len > have)
      len = have;
    if (len < min_block && (len === 0 && flush !== 4 || flush === 0 || len !== left + s.strm.avail_in))
      break;
    last = flush === 4 && len === left + s.strm.avail_in ? 1 : 0;
    _tr_stored_block(s, 0, 0, last);
    s.pending_buf[s.pending - 4] = len;
    s.pending_buf[s.pending - 3] = len >> 8;
    s.pending_buf[s.pending - 2] = ~len;
    s.pending_buf[s.pending - 1] = ~len >> 8;
    flush_pending(s.strm);
    if (left) {
      if (left > len)
        left = len;
      s.strm.output.set(s.window.subarray(s.block_start, s.block_start + left), s.strm.next_out);
      s.strm.next_out += left;
      s.strm.avail_out -= left;
      s.strm.total_out += left;
      s.block_start += left;
      len -= left;
    }
    if (len) {
      read_buf(s.strm, s.strm.output, s.strm.next_out, len);
      s.strm.next_out += len;
      s.strm.avail_out -= len;
      s.strm.total_out += len;
    }
  } while (last === 0);
  used -= s.strm.avail_in;
  if (used) {
    if (used >= s.w_size) {
      s.matches = 2;
      s.window.set(s.strm.input.subarray(s.strm.next_in - s.w_size, s.strm.next_in), 0);
      s.strstart = s.w_size;
      s.insert = s.strstart;
    } else {
      if (s.window_size - s.strstart <= used) {
        s.strstart -= s.w_size;
        s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
        if (s.matches < 2)
          s.matches++;
        if (s.insert > s.strstart)
          s.insert = s.strstart;
      }
      s.window.set(s.strm.input.subarray(s.strm.next_in - used, s.strm.next_in), s.strstart);
      s.strstart += used;
      s.insert += used > s.w_size - s.insert ? s.w_size - s.insert : used;
    }
    s.block_start = s.strstart;
  }
  if (s.high_water < s.strstart)
    s.high_water = s.strstart;
  if (last)
    return BS_FINISH_DONE;
  if (flush !== 0 && flush !== 4 && s.strm.avail_in === 0 && s.strstart === s.block_start)
    return BS_BLOCK_DONE;
  have = s.window_size - s.strstart;
  if (s.strm.avail_in > have && s.block_start >= s.w_size) {
    s.block_start -= s.w_size;
    s.strstart -= s.w_size;
    s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
    if (s.matches < 2)
      s.matches++;
    have += s.w_size;
    if (s.insert > s.strstart)
      s.insert = s.strstart;
  }
  if (have > s.strm.avail_in)
    have = s.strm.avail_in;
  if (have) {
    read_buf(s.strm, s.window, s.strstart, have);
    s.strstart += have;
    s.insert += have > s.w_size - s.insert ? s.w_size - s.insert : have;
  }
  if (s.high_water < s.strstart)
    s.high_water = s.strstart;
  have = s.bi_valid + 42 >> 3;
  have = s.pending_buf_size - have > 65535 ? 65535 : s.pending_buf_size - have;
  min_block = have > s.w_size ? s.w_size : have;
  left = s.strstart - s.block_start;
  if (left >= min_block || (left || flush === 4) && flush !== 0 && s.strm.avail_in === 0 && left <= have) {
    len = left > have ? have : left;
    last = flush === 4 && s.strm.avail_in === 0 && len === left ? 1 : 0;
    _tr_stored_block(s, s.block_start, len, last);
    s.block_start += len;
    flush_pending(s.strm);
  }
  return last ? BS_FINISH_STARTED : BS_NEED_MORE;
};
var deflate_fast = (s, flush) => {
  let hash_head;
  let bflush;
  for (;; ) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === 0)
        return BS_NEED_MORE;
      if (s.lookahead === 0)
        break;
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH)
      hash_head = INSERT_STRING(s, s.strstart);
    if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD)
      s.match_length = longest_match(s, hash_head);
    if (s.match_length >= MIN_MATCH) {
      bflush = _tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
        s.match_length--;
        do {
          s.strstart++;
          hash_head = INSERT_STRING(s, s.strstart);
        } while (--s.match_length !== 0);
        s.strstart++;
      } else {
        s.strstart += s.match_length;
        s.match_length = 0;
        if (s.legacy_hash) {
          s.ins_h = s.window[s.strstart];
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + 1]);
        }
      }
    } else {
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0)
        return BS_NEED_MORE;
    }
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === 4) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0)
      return BS_FINISH_STARTED;
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0)
      return BS_NEED_MORE;
  }
  return BS_BLOCK_DONE;
};
var deflate_slow = (s, flush) => {
  let hash_head;
  let bflush;
  let max_insert;
  for (;; ) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === 0)
        return BS_NEED_MORE;
      if (s.lookahead === 0)
        break;
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH)
      hash_head = INSERT_STRING(s, s.strstart);
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH - 1;
    if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
      s.match_length = longest_match(s, hash_head);
      if (s.match_length <= 5 && (s.strategy === 1 || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096))
        s.match_length = MIN_MATCH - 1;
    }
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH;
      bflush = _tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
      s.lookahead -= s.prev_length - 1;
      s.prev_length -= 2;
      do
        if (++s.strstart <= max_insert)
          hash_head = INSERT_STRING(s, s.strstart);
      while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH - 1;
      s.strstart++;
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0)
          return BS_NEED_MORE;
      }
    } else if (s.match_available) {
      bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
      if (bflush)
        flush_block_only(s, false);
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0)
        return BS_NEED_MORE;
    } else {
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  if (s.match_available) {
    bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === 4) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0)
      return BS_FINISH_STARTED;
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0)
      return BS_NEED_MORE;
  }
  return BS_BLOCK_DONE;
};
var deflate_rle = (s, flush) => {
  let bflush;
  let prev;
  let scan, strend;
  const _win = s.window;
  for (;; ) {
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s);
      if (s.lookahead <= MAX_MATCH && flush === 0)
        return BS_NEED_MORE;
      if (s.lookahead === 0)
        break;
    }
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH;
        do
          ;
        while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
        s.match_length = MAX_MATCH - (strend - scan);
        if (s.match_length > s.lookahead)
          s.match_length = s.lookahead;
      }
    }
    if (s.match_length >= MIN_MATCH) {
      bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
    } else {
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0)
        return BS_NEED_MORE;
    }
  }
  s.insert = 0;
  if (flush === 4) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0)
      return BS_FINISH_STARTED;
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0)
      return BS_NEED_MORE;
  }
  return BS_BLOCK_DONE;
};
var deflate_huff = (s, flush) => {
  let bflush;
  for (;; ) {
    if (s.lookahead === 0) {
      fill_window(s);
      if (s.lookahead === 0) {
        if (flush === 0)
          return BS_NEED_MORE;
        break;
      }
    }
    s.match_length = 0;
    bflush = _tr_tally(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0)
        return BS_NEED_MORE;
    }
  }
  s.insert = 0;
  if (flush === 4) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0)
      return BS_FINISH_STARTED;
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0)
      return BS_NEED_MORE;
  }
  return BS_BLOCK_DONE;
};
var Config = class {
  constructor(good_length, max_lazy, nice_length, max_chain, func) {
    this.good_length = good_length;
    this.max_lazy = max_lazy;
    this.nice_length = nice_length;
    this.max_chain = max_chain;
    this.func = func;
  }
};
var configuration_table = [
  new Config(0, 0, 0, 0, deflate_stored),
  new Config(4, 4, 8, 4, deflate_fast),
  new Config(4, 5, 16, 8, deflate_fast),
  new Config(4, 6, 32, 32, deflate_fast),
  new Config(4, 4, 16, 16, deflate_slow),
  new Config(8, 16, 32, 32, deflate_slow),
  new Config(8, 16, 128, 128, deflate_slow),
  new Config(8, 32, 128, 256, deflate_slow),
  new Config(32, 128, 258, 1024, deflate_slow),
  new Config(32, 258, 258, 4096, deflate_slow)
];
var lm_init = (s) => {
  s.window_size = 2 * s.w_size;
  zero(s.head);
  s.max_lazy_match = configuration_table[s.level].max_lazy;
  s.good_match = configuration_table[s.level].good_length;
  s.nice_match = configuration_table[s.level].nice_length;
  s.max_chain_length = configuration_table[s.level].max_chain;
  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  s.ins_h = 0;
};
var DeflateState = class {
  constructor() {
    this.strm = null;
    this.status = 0;
    this.pending_buf = null;
    this.pending_buf_size = 0;
    this.pending_out = 0;
    this.pending = 0;
    this.wrap = 0;
    this.gzhead = null;
    this.gzindex = 0;
    this.method = 8;
    this.last_flush = -1;
    this.w_size = 0;
    this.w_bits = 0;
    this.w_mask = 0;
    this.window = null;
    this.window_size = 0;
    this.prev = null;
    this.head = null;
    this.ins_h = 0;
    this.legacy_hash = 0;
    this.hash_size = 0;
    this.hash_bits = 0;
    this.hash_mask = 0;
    this.hash_shift = 0;
    this.block_start = 0;
    this.match_length = 0;
    this.prev_match = 0;
    this.match_available = 0;
    this.strstart = 0;
    this.match_start = 0;
    this.lookahead = 0;
    this.prev_length = 0;
    this.max_chain_length = 0;
    this.max_lazy_match = 0;
    this.level = 0;
    this.strategy = 0;
    this.good_match = 0;
    this.nice_match = 0;
    this.dyn_ltree = new Uint16Array(HEAP_SIZE * 2);
    this.dyn_dtree = /* @__PURE__ */ new Uint16Array(122);
    this.bl_tree = /* @__PURE__ */ new Uint16Array(78);
    zero(this.dyn_ltree);
    zero(this.dyn_dtree);
    zero(this.bl_tree);
    this.l_desc = null;
    this.d_desc = null;
    this.bl_desc = null;
    this.bl_count = /* @__PURE__ */ new Uint16Array(16);
    this.heap = /* @__PURE__ */ new Uint16Array(573);
    zero(this.heap);
    this.heap_len = 0;
    this.heap_max = 0;
    this.depth = /* @__PURE__ */ new Uint16Array(573);
    zero(this.depth);
    this.sym_buf = 0;
    this.lit_bufsize = 0;
    this.sym_next = 0;
    this.sym_end = 0;
    this.opt_len = 0;
    this.static_len = 0;
    this.matches = 0;
    this.insert = 0;
    this.bi_buf = 0;
    this.bi_valid = 0;
  }
};
var deflateStateCheck = (strm) => {
  if (!strm)
    return 1;
  const s = strm.state;
  if (!s || s.strm !== strm || s.status !== INIT_STATE && s.status !== GZIP_STATE && s.status !== EXTRA_STATE && s.status !== NAME_STATE && s.status !== COMMENT_STATE && s.status !== HCRC_STATE && s.status !== BUSY_STATE && s.status !== FINISH_STATE)
    return 1;
  return 0;
};
var deflateResetKeep = (strm) => {
  if (deflateStateCheck(strm))
    return err(strm, -2);
  strm.total_in = strm.total_out = 0;
  strm.data_type = 2;
  const s = strm.state;
  s.pending = 0;
  s.pending_out = 0;
  if (s.wrap < 0)
    s.wrap = -s.wrap;
  s.status = s.wrap === 2 ? GZIP_STATE : s.wrap ? INIT_STATE : BUSY_STATE;
  strm.adler = s.wrap === 2 ? 0 : 1;
  s.last_flush = -2;
  _tr_init(s);
  return 0;
};
var deflateReset = (strm) => {
  const ret = deflateResetKeep(strm);
  if (ret === 0)
    lm_init(strm.state);
  return ret;
};
var deflateInit2 = (strm, level, method, windowBits, memLevel, strategy, legacyHash) => {
  if (!strm)
    return -2;
  let wrap = 1;
  if (level === -1)
    level = 6;
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else if (windowBits > 15) {
    wrap = 2;
    windowBits -= 16;
  }
  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== 8 || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > 4 || windowBits === 8 && wrap !== 1)
    return err(strm, -2);
  if (windowBits === 8)
    windowBits = 9;
  const s = new DeflateState;
  strm.state = s;
  s.strm = strm;
  s.status = INIT_STATE;
  s.wrap = wrap;
  s.gzhead = null;
  s.w_bits = windowBits;
  s.w_size = 1 << s.w_bits;
  s.w_mask = s.w_size - 1;
  s.legacy_hash = legacyHash ? 1 : 0;
  s.hash_bits = memLevel + 7;
  if (!s.legacy_hash && s.hash_bits < 15)
    s.hash_bits = 15;
  s.hash_size = 1 << s.hash_bits;
  s.hash_mask = s.hash_size - 1;
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
  s.window = new Uint8Array(s.w_size * 2);
  s.head = new Uint16Array(s.hash_size);
  s.prev = new Uint16Array(s.w_size);
  s.lit_bufsize = 1 << memLevel + 6;
  s.pending_buf_size = s.lit_bufsize * 4;
  s.pending_buf = new Uint8Array(s.pending_buf_size);
  s.sym_buf = s.lit_bufsize;
  s.sym_end = (s.lit_bufsize - 1) * 3;
  s.level = level;
  s.strategy = strategy;
  s.method = method;
  return deflateReset(strm);
};
var deflate$1 = (strm, flush) => {
  if (deflateStateCheck(strm) || flush > 5 || flush < 0)
    return strm ? err(strm, -2) : -2;
  const s = strm.state;
  if (!strm.output || strm.avail_in !== 0 && !strm.input || s.status === FINISH_STATE && flush !== 4)
    return err(strm, strm.avail_out === 0 ? -5 : -2);
  const old_flush = s.last_flush;
  s.last_flush = flush;
  if (s.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      s.last_flush = -1;
      return 0;
    }
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== 4)
    return err(strm, -5);
  if (s.status === FINISH_STATE && strm.avail_in !== 0)
    return err(strm, -5);
  if (s.status === INIT_STATE && s.wrap === 0)
    s.status = BUSY_STATE;
  if (s.status === INIT_STATE) {
    let header = 8 + (s.w_bits - 8 << 4) << 8;
    let level_flags = -1;
    if (s.strategy >= 2 || s.level < 2)
      level_flags = 0;
    else if (s.level < 6)
      level_flags = 1;
    else if (s.level === 6)
      level_flags = 2;
    else
      level_flags = 3;
    header |= level_flags << 6;
    if (s.strstart !== 0)
      header |= PRESET_DICT;
    header += 31 - header % 31;
    putShortMSB(s, header);
    if (s.strstart !== 0) {
      putShortMSB(s, strm.adler >>> 16);
      putShortMSB(s, strm.adler & 65535);
    }
    strm.adler = 1;
    s.status = BUSY_STATE;
    flush_pending(strm);
    if (s.pending !== 0) {
      s.last_flush = -1;
      return 0;
    }
  }
  if (s.status === GZIP_STATE) {
    strm.adler = 0;
    put_byte(s, 31);
    put_byte(s, 139);
    put_byte(s, 8);
    if (!s.gzhead) {
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, s.level === 9 ? 2 : s.strategy >= 2 || s.level < 2 ? 4 : 0);
      put_byte(s, OS_CODE);
      s.status = BUSY_STATE;
      flush_pending(strm);
      if (s.pending !== 0) {
        s.last_flush = -1;
        return 0;
      }
    } else {
      put_byte(s, (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16));
      put_byte(s, s.gzhead.time & 255);
      put_byte(s, s.gzhead.time >> 8 & 255);
      put_byte(s, s.gzhead.time >> 16 & 255);
      put_byte(s, s.gzhead.time >> 24 & 255);
      put_byte(s, s.level === 9 ? 2 : s.strategy >= 2 || s.level < 2 ? 4 : 0);
      put_byte(s, s.gzhead.os & 255);
      if (s.gzhead.extra && s.gzhead.extra.length) {
        put_byte(s, s.gzhead.extra.length & 255);
        put_byte(s, s.gzhead.extra.length >> 8 & 255);
      }
      if (s.gzhead.hcrc)
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending, 0);
      s.gzindex = 0;
      s.status = EXTRA_STATE;
    }
  }
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra) {
      let beg = s.pending;
      let left = (s.gzhead.extra.length & 65535) - s.gzindex;
      while (s.pending + left > s.pending_buf_size) {
        let copy = s.pending_buf_size - s.pending;
        s.pending_buf.set(s.gzhead.extra.subarray(s.gzindex, s.gzindex + copy), s.pending);
        s.pending = s.pending_buf_size;
        if (s.gzhead.hcrc && s.pending > beg)
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        s.gzindex += copy;
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return 0;
        }
        beg = 0;
        left -= copy;
      }
      let gzhead_extra = new Uint8Array(s.gzhead.extra);
      s.pending_buf.set(gzhead_extra.subarray(s.gzindex, s.gzindex + left), s.pending);
      s.pending += left;
      if (s.gzhead.hcrc && s.pending > beg)
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      s.gzindex = 0;
    }
    s.status = NAME_STATE;
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name) {
      let beg = s.pending;
      let val;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg)
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return 0;
          }
          beg = 0;
        }
        if (s.gzindex < s.gzhead.name.length)
          val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
        else
          val = 0;
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg)
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      s.gzindex = 0;
    }
    s.status = COMMENT_STATE;
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment) {
      let beg = s.pending;
      let val;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg)
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return 0;
          }
          beg = 0;
        }
        if (s.gzindex < s.gzhead.comment.length)
          val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
        else
          val = 0;
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg)
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
    }
    s.status = HCRC_STATE;
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return 0;
        }
      }
      put_byte(s, strm.adler & 255);
      put_byte(s, strm.adler >> 8 & 255);
      strm.adler = 0;
    }
    s.status = BUSY_STATE;
    flush_pending(strm);
    if (s.pending !== 0) {
      s.last_flush = -1;
      return 0;
    }
  }
  if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== 0 && s.status !== FINISH_STATE) {
    let bstate = s.level === 0 ? deflate_stored(s, flush) : s.strategy === 2 ? deflate_huff(s, flush) : s.strategy === 3 ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE)
      s.status = FINISH_STATE;
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0)
        s.last_flush = -1;
      return 0;
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === 1)
        _tr_align(s);
      else if (flush !== 5) {
        _tr_stored_block(s, 0, 0, false);
        if (flush === 3) {
          zero(s.head);
          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        return 0;
      }
    }
  }
  if (flush !== 4)
    return 0;
  if (s.wrap <= 0)
    return 1;
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 255);
    put_byte(s, strm.adler >> 8 & 255);
    put_byte(s, strm.adler >> 16 & 255);
    put_byte(s, strm.adler >> 24 & 255);
    put_byte(s, strm.total_in & 255);
    put_byte(s, strm.total_in >> 8 & 255);
    put_byte(s, strm.total_in >> 16 & 255);
    put_byte(s, strm.total_in >> 24 & 255);
  } else {
    putShortMSB(s, strm.adler >>> 16);
    putShortMSB(s, strm.adler & 65535);
  }
  flush_pending(strm);
  if (s.wrap > 0)
    s.wrap = -s.wrap;
  return s.pending !== 0 ? 0 : 1;
};
var deflateEnd = (strm) => {
  if (deflateStateCheck(strm))
    return -2;
  const status = strm.state.status;
  strm.state = null;
  return status === BUSY_STATE ? err(strm, -3) : 0;
};
var deflateSetDictionary = (strm, dictionary) => {
  let dictLength = dictionary.length;
  if (deflateStateCheck(strm))
    return -2;
  const s = strm.state;
  const wrap = s.wrap;
  if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead)
    return -2;
  if (wrap === 1)
    strm.adler = adler32(strm.adler, dictionary, dictLength, 0);
  s.wrap = 0;
  if (dictLength >= s.w_size) {
    if (wrap === 0) {
      zero(s.head);
      s.strstart = 0;
      s.block_start = 0;
      s.insert = 0;
    }
    let tmpDict = new Uint8Array(s.w_size);
    tmpDict.set(dictionary.subarray(dictLength - s.w_size, dictLength), 0);
    dictionary = tmpDict;
    dictLength = s.w_size;
  }
  const avail = strm.avail_in;
  const next = strm.next_in;
  const input = strm.input;
  strm.avail_in = dictLength;
  strm.next_in = 0;
  strm.input = dictionary;
  fill_window(s);
  while (s.lookahead >= MIN_MATCH) {
    let str = s.strstart;
    let n = s.lookahead - (MIN_MATCH - 1);
    do {
      INSERT_STRING(s, str);
      str++;
    } while (--n);
    s.strstart = str;
    s.lookahead = MIN_MATCH - 1;
    fill_window(s);
  }
  s.strstart += s.lookahead;
  s.block_start = s.strstart;
  s.insert = s.lookahead;
  s.lookahead = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  strm.next_in = next;
  strm.input = input;
  strm.avail_in = avail;
  s.wrap = wrap;
  return 0;
};
var BAD$1 = 16209;
var TYPE$1 = 16191;
function inflate_fast(strm, start) {
  let _in;
  let last;
  let _out;
  let beg;
  let end;
  let dmax;
  let wsize;
  let whave;
  let wnext;
  let s_window;
  let hold;
  let bits;
  let lcode;
  let dcode;
  let lmask;
  let dmask;
  let here;
  let op;
  let len;
  let dist;
  let from;
  let from_source;
  let input, output;
  const state = strm.state;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
  dmax = state.dmax;
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  s_window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;
  top:
    do {
      if (bits < 15) {
        hold += input[_in++] << bits;
        bits += 8;
        hold += input[_in++] << bits;
        bits += 8;
      }
      here = lcode[hold & lmask];
      dolen:
        for (;; ) {
          op = here >>> 24;
          hold >>>= op;
          bits -= op;
          op = here >>> 16 & 255;
          if (op === 0)
            output[_out++] = here & 65535;
          else if (op & 16) {
            len = here & 65535;
            op &= 15;
            if (op) {
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
              len += hold & (1 << op) - 1;
              hold >>>= op;
              bits -= op;
            }
            if (bits < 15) {
              hold += input[_in++] << bits;
              bits += 8;
              hold += input[_in++] << bits;
              bits += 8;
            }
            here = dcode[hold & dmask];
            dodist:
              for (;; ) {
                op = here >>> 24;
                hold >>>= op;
                bits -= op;
                op = here >>> 16 & 255;
                if (op & 16) {
                  dist = here & 65535;
                  op &= 15;
                  if (bits < op) {
                    hold += input[_in++] << bits;
                    bits += 8;
                    if (bits < op) {
                      hold += input[_in++] << bits;
                      bits += 8;
                    }
                  }
                  dist += hold & (1 << op) - 1;
                  if (dist > dmax) {
                    strm.msg = "invalid distance too far back";
                    state.mode = BAD$1;
                    break top;
                  }
                  hold >>>= op;
                  bits -= op;
                  op = _out - beg;
                  if (dist > op) {
                    op = dist - op;
                    if (op > whave) {
                      if (state.sane) {
                        strm.msg = "invalid distance too far back";
                        state.mode = BAD$1;
                        break top;
                      }
                    }
                    from = 0;
                    from_source = s_window;
                    if (wnext === 0) {
                      from += wsize - op;
                      if (op < len) {
                        len -= op;
                        do
                          output[_out++] = s_window[from++];
                        while (--op);
                        from = _out - dist;
                        from_source = output;
                      }
                    } else if (wnext < op) {
                      from += wsize + wnext - op;
                      op -= wnext;
                      if (op < len) {
                        len -= op;
                        do
                          output[_out++] = s_window[from++];
                        while (--op);
                        from = 0;
                        if (wnext < len) {
                          op = wnext;
                          len -= op;
                          do
                            output[_out++] = s_window[from++];
                          while (--op);
                          from = _out - dist;
                          from_source = output;
                        }
                      }
                    } else {
                      from += wnext - op;
                      if (op < len) {
                        len -= op;
                        do
                          output[_out++] = s_window[from++];
                        while (--op);
                        from = _out - dist;
                        from_source = output;
                      }
                    }
                    while (len > 2) {
                      output[_out++] = from_source[from++];
                      output[_out++] = from_source[from++];
                      output[_out++] = from_source[from++];
                      len -= 3;
                    }
                    if (len) {
                      output[_out++] = from_source[from++];
                      if (len > 1)
                        output[_out++] = from_source[from++];
                    }
                  } else {
                    from = _out - dist;
                    do {
                      output[_out++] = output[from++];
                      output[_out++] = output[from++];
                      output[_out++] = output[from++];
                      len -= 3;
                    } while (len > 2);
                    if (len) {
                      output[_out++] = output[from++];
                      if (len > 1)
                        output[_out++] = output[from++];
                    }
                  }
                } else if ((op & 64) === 0) {
                  here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
                  continue dodist;
                } else {
                  strm.msg = "invalid distance code";
                  state.mode = BAD$1;
                  break top;
                }
                break;
              }
          } else if ((op & 64) === 0) {
            here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
            continue dolen;
          } else if (op & 32) {
            state.mode = TYPE$1;
            break top;
          } else {
            strm.msg = "invalid literal/length code";
            state.mode = BAD$1;
            break top;
          }
          break;
        }
    } while (_in < last && _out < end);
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
  strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
  state.hold = hold;
  state.bits = bits;
}
var MAXBITS = 15;
var ENOUGH_LENS$1 = 852;
var ENOUGH_DISTS$1 = 592;
var CODES$1 = 0;
var LENS$1 = 1;
var DISTS$1 = 2;
var lbase = new Uint16Array([
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  13,
  15,
  17,
  19,
  23,
  27,
  31,
  35,
  43,
  51,
  59,
  67,
  83,
  99,
  115,
  131,
  163,
  195,
  227,
  258,
  0,
  0
]);
var lext = new Uint8Array([
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  17,
  17,
  17,
  17,
  18,
  18,
  18,
  18,
  19,
  19,
  19,
  19,
  20,
  20,
  20,
  20,
  21,
  21,
  21,
  21,
  16,
  199,
  75
]);
var dbase = new Uint16Array([
  1,
  2,
  3,
  4,
  5,
  7,
  9,
  13,
  17,
  25,
  33,
  49,
  65,
  97,
  129,
  193,
  257,
  385,
  513,
  769,
  1025,
  1537,
  2049,
  3073,
  4097,
  6145,
  8193,
  12289,
  16385,
  24577,
  0,
  0
]);
var dext = new Uint8Array([
  16,
  16,
  16,
  16,
  17,
  17,
  18,
  18,
  19,
  19,
  20,
  20,
  21,
  21,
  22,
  22,
  23,
  23,
  24,
  24,
  25,
  25,
  26,
  26,
  27,
  27,
  28,
  28,
  29,
  29,
  64,
  64
]);
var inflate_table = (type, lens, lens_index, codes, table, table_index, work, opts) => {
  const bits = opts.bits;
  let len = 0;
  let sym = 0;
  let min = 0, max = 0;
  let root = 0;
  let curr = 0;
  let drop = 0;
  let left = 0;
  let used = 0;
  let huff = 0;
  let incr;
  let fill;
  let low;
  let mask;
  let next;
  let base = null;
  let match;
  const count = /* @__PURE__ */ new Uint16Array(16);
  const offs = /* @__PURE__ */ new Uint16Array(16);
  let extra = null;
  let here_bits, here_op, here_val;
  for (len = 0;len <= MAXBITS; len++)
    count[len] = 0;
  for (sym = 0;sym < codes; sym++)
    count[lens[lens_index + sym]]++;
  root = bits;
  for (max = MAXBITS;max >= 1; max--)
    if (count[max] !== 0)
      break;
  if (root > max)
    root = max;
  if (max === 0) {
    table[table_index++] = 20971520;
    table[table_index++] = 20971520;
    opts.bits = 1;
    return 0;
  }
  for (min = 1;min < max; min++)
    if (count[min] !== 0)
      break;
  if (root < min)
    root = min;
  left = 1;
  for (len = 1;len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0)
      return -1;
  }
  if (left > 0 && (type === CODES$1 || max !== 1))
    return -1;
  offs[1] = 0;
  for (len = 1;len < MAXBITS; len++)
    offs[len + 1] = offs[len] + count[len];
  for (sym = 0;sym < codes; sym++)
    if (lens[lens_index + sym] !== 0)
      work[offs[lens[lens_index + sym]]++] = sym;
  if (type === CODES$1) {
    base = extra = work;
    match = 20;
  } else if (type === LENS$1) {
    base = lbase;
    extra = lext;
    match = 257;
  } else {
    base = dbase;
    extra = dext;
    match = 0;
  }
  huff = 0;
  sym = 0;
  len = min;
  next = table_index;
  curr = root;
  drop = 0;
  low = -1;
  used = 1 << root;
  mask = used - 1;
  if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1)
    return 1;
  for (;; ) {
    here_bits = len - drop;
    if (work[sym] + 1 < match) {
      here_op = 0;
      here_val = work[sym];
    } else if (work[sym] >= match) {
      here_op = extra[work[sym] - match];
      here_val = base[work[sym] - match];
    } else {
      here_op = 96;
      here_val = 0;
    }
    incr = 1 << len - drop;
    fill = 1 << curr;
    min = fill;
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
    } while (fill !== 0);
    incr = 1 << len - 1;
    while (huff & incr)
      incr >>= 1;
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else
      huff = 0;
    sym++;
    if (--count[len] === 0) {
      if (len === max)
        break;
      len = lens[lens_index + work[sym]];
    }
    if (len > root && (huff & mask) !== low) {
      if (drop === 0)
        drop = root;
      next += min;
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max) {
        left -= count[curr + drop];
        if (left <= 0)
          break;
        curr++;
        left <<= 1;
      }
      used += 1 << curr;
      if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1)
        return 1;
      low = huff & mask;
      table[low] = root << 24 | curr << 16 | next - table_index | 0;
    }
  }
  if (huff !== 0)
    table[next + huff] = len - drop << 24 | 4194304;
  opts.bits = root;
  return 0;
};
var CODES = 0;
var LENS = 1;
var DISTS = 2;
var HEAD = 16180;
var FLAGS = 16181;
var TIME = 16182;
var OS = 16183;
var EXLEN = 16184;
var EXTRA = 16185;
var NAME = 16186;
var COMMENT = 16187;
var HCRC = 16188;
var DICTID = 16189;
var DICT = 16190;
var TYPE = 16191;
var TYPEDO = 16192;
var STORED = 16193;
var COPY_ = 16194;
var COPY = 16195;
var TABLE = 16196;
var LENLENS = 16197;
var CODELENS = 16198;
var LEN_ = 16199;
var LEN = 16200;
var LENEXT = 16201;
var DIST = 16202;
var DISTEXT = 16203;
var MATCH = 16204;
var LIT = 16205;
var CHECK = 16206;
var LENGTH = 16207;
var DONE = 16208;
var BAD = 16209;
var MEM = 16210;
var SYNC = 16211;
var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
var zswap32 = (q) => {
  return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
};
var InflateState = class {
  constructor() {
    this.strm = null;
    this.mode = 0;
    this.last = false;
    this.wrap = 0;
    this.havedict = false;
    this.flags = 0;
    this.dmax = 0;
    this.check = 0;
    this.total = 0;
    this.head = null;
    this.wbits = 0;
    this.wsize = 0;
    this.whave = 0;
    this.wnext = 0;
    this.window = null;
    this.hold = 0;
    this.bits = 0;
    this.length = 0;
    this.offset = 0;
    this.extra = 0;
    this.lencode = null;
    this.distcode = null;
    this.lenbits = 0;
    this.distbits = 0;
    this.ncode = 0;
    this.nlen = 0;
    this.ndist = 0;
    this.have = 0;
    this.next = null;
    this.lens = /* @__PURE__ */ new Uint16Array(320);
    this.work = /* @__PURE__ */ new Uint16Array(288);
    this.lendyn = null;
    this.distdyn = null;
    this.sane = 0;
    this.back = 0;
    this.was = 0;
  }
};
var inflateStateCheck = (strm) => {
  if (!strm)
    return 1;
  const state = strm.state;
  if (!state || state.strm !== strm || state.mode < HEAD || state.mode > SYNC)
    return 1;
  return 0;
};
var inflateResetKeep = (strm) => {
  if (inflateStateCheck(strm))
    return -2;
  const state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = "";
  if (state.wrap)
    strm.adler = state.wrap & 1;
  state.mode = HEAD;
  state.last = 0;
  state.havedict = 0;
  state.flags = -1;
  state.dmax = 32768;
  state.head = null;
  state.hold = 0;
  state.bits = 0;
  state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS);
  state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS);
  state.sane = 1;
  state.back = -1;
  return 0;
};
var inflateReset = (strm) => {
  if (inflateStateCheck(strm))
    return -2;
  const state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);
};
var inflateReset2 = (strm, windowBits) => {
  let wrap;
  if (inflateStateCheck(strm))
    return -2;
  const state = strm.state;
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else {
    wrap = (windowBits >> 4) + 5;
    if (windowBits < 48)
      windowBits &= 15;
  }
  if (windowBits && (windowBits < 8 || windowBits > 15))
    return -2;
  if (state.window !== null && state.wbits !== windowBits)
    state.window = null;
  state.wrap = wrap;
  state.wbits = windowBits;
  return inflateReset(strm);
};
var inflateInit2 = (strm, windowBits) => {
  if (!strm)
    return -2;
  const state = new InflateState;
  strm.state = state;
  state.strm = strm;
  state.window = null;
  state.mode = HEAD;
  const ret = inflateReset2(strm, windowBits);
  if (ret !== 0)
    strm.state = null;
  return ret;
};
var virgin = true;
var lenfix;
var distfix;
var fixedtables = (state) => {
  if (virgin) {
    lenfix = /* @__PURE__ */ new Int32Array(512);
    distfix = /* @__PURE__ */ new Int32Array(32);
    let sym = 0;
    while (sym < 144)
      state.lens[sym++] = 8;
    while (sym < 256)
      state.lens[sym++] = 9;
    while (sym < 280)
      state.lens[sym++] = 7;
    while (sym < 288)
      state.lens[sym++] = 8;
    inflate_table(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
    sym = 0;
    while (sym < 32)
      state.lens[sym++] = 5;
    inflate_table(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
    virgin = false;
  }
  state.lencode = lenfix;
  state.lenbits = 9;
  state.distcode = distfix;
  state.distbits = 5;
};
var updatewindow = (strm, src, end, copy) => {
  let dist;
  const state = strm.state;
  if (state.window === null)
    state.window = new Uint8Array(1 << state.wbits);
  if (state.wsize === 0) {
    state.wsize = 1 << state.wbits;
    state.wnext = 0;
    state.whave = 0;
  }
  if (copy >= state.wsize) {
    state.window.set(src.subarray(end - state.wsize, end), 0);
    state.wnext = 0;
    state.whave = state.wsize;
  } else {
    dist = state.wsize - state.wnext;
    if (dist > copy)
      dist = copy;
    state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext);
    copy -= dist;
    if (copy) {
      state.window.set(src.subarray(end - copy, end), 0);
      state.wnext = copy;
      state.whave = state.wsize;
    } else {
      state.wnext += dist;
      if (state.wnext === state.wsize)
        state.wnext = 0;
      if (state.whave < state.wsize)
        state.whave += dist;
    }
  }
  return 0;
};
var inflate$1 = (strm, flush) => {
  let state;
  let input, output;
  let next;
  let put;
  let have, left;
  let hold;
  let bits;
  let _in, _out;
  let copy;
  let from;
  let from_source;
  let here = 0;
  let here_bits, here_op, here_val;
  let last_bits, last_op, last_val;
  let len;
  let ret;
  const hbuf = /* @__PURE__ */ new Uint8Array(4);
  let opts;
  let n;
  const order = new Uint8Array([
    16,
    17,
    18,
    0,
    8,
    7,
    9,
    6,
    10,
    5,
    11,
    4,
    12,
    3,
    13,
    2,
    14,
    1,
    15
  ]);
  if (inflateStateCheck(strm) || !strm.output || !strm.input && strm.avail_in !== 0)
    return -2;
  state = strm.state;
  if (state.mode === TYPE)
    state.mode = TYPEDO;
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  _in = have;
  _out = left;
  ret = 0;
  inf_leave:
    for (;; )
      switch (state.mode) {
        case HEAD:
          if (state.wrap === 0) {
            state.mode = TYPEDO;
            break;
          }
          while (bits < 16) {
            if (have === 0)
              break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.wrap & 2 && hold === 35615) {
            if (state.wbits === 0)
              state.wbits = 15;
            state.check = 0;
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32(state.check, hbuf, 2, 0);
            hold = 0;
            bits = 0;
            state.mode = FLAGS;
            break;
          }
          if (state.head)
            state.head.done = false;
          if (!(state.wrap & 1) || (((hold & 255) << 8) + (hold >> 8)) % 31) {
            strm.msg = "incorrect header check";
            state.mode = BAD;
            break;
          }
          if ((hold & 15) !== 8) {
            strm.msg = "unknown compression method";
            state.mode = BAD;
            break;
          }
          hold >>>= 4;
          bits -= 4;
          len = (hold & 15) + 8;
          if (state.wbits === 0)
            state.wbits = len;
          if (len > 15 || len > state.wbits) {
            strm.msg = "invalid window size";
            state.mode = BAD;
            break;
          }
          state.dmax = 1 << state.wbits;
          state.flags = 0;
          strm.adler = state.check = 1;
          state.mode = hold & 512 ? DICTID : TYPE;
          hold = 0;
          bits = 0;
          break;
        case FLAGS:
          while (bits < 16) {
            if (have === 0)
              break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.flags = hold;
          if ((state.flags & 255) !== 8) {
            strm.msg = "unknown compression method";
            state.mode = BAD;
            break;
          }
          if (state.flags & 57344) {
            strm.msg = "unknown header flags set";
            state.mode = BAD;
            break;
          }
          if (state.head)
            state.head.text = hold >> 8 & 1;
          if (state.flags & 512 && state.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = TIME;
        case TIME:
          while (bits < 32) {
            if (have === 0)
              break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.head)
            state.head.time = hold;
          if (state.flags & 512 && state.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            hbuf[2] = hold >>> 16 & 255;
            hbuf[3] = hold >>> 24 & 255;
            state.check = crc32(state.check, hbuf, 4, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = OS;
        case OS:
          while (bits < 16) {
            if (have === 0)
              break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.head) {
            state.head.xflags = hold & 255;
            state.head.os = hold >> 8;
          }
          if (state.flags & 512 && state.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = EXLEN;
        case EXLEN:
          if (state.flags & 1024) {
            while (bits < 16) {
              if (have === 0)
                break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.length = hold;
            if (state.head)
              state.head.extra_len = hold;
            if (state.flags & 512 && state.wrap & 4) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32(state.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
          } else if (state.head)
            state.head.extra = null;
          state.mode = EXTRA;
        case EXTRA:
          if (state.flags & 1024) {
            copy = state.length;
            if (copy > have)
              copy = have;
            if (copy) {
              if (state.head) {
                len = state.head.extra_len - state.length;
                if (!state.head.extra)
                  state.head.extra = new Uint8Array(state.head.extra_len);
                state.head.extra.set(input.subarray(next, next + copy), len);
              }
              if (state.flags & 512 && state.wrap & 4)
                state.check = crc32(state.check, input, copy, next);
              have -= copy;
              next += copy;
              state.length -= copy;
            }
            if (state.length)
              break inf_leave;
          }
          state.length = 0;
          state.mode = NAME;
        case NAME:
          if (state.flags & 2048) {
            if (have === 0)
              break inf_leave;
            copy = 0;
            do {
              len = input[next + copy++];
              if (state.head && len && state.length < 65536)
                state.head.name += String.fromCharCode(len);
            } while (len && copy < have);
            if (state.flags & 512 && state.wrap & 4)
              state.check = crc32(state.check, input, copy, next);
            have -= copy;
            next += copy;
            if (len)
              break inf_leave;
          } else if (state.head)
            state.head.name = null;
          state.length = 0;
          state.mode = COMMENT;
        case COMMENT:
          if (state.flags & 4096) {
            if (have === 0)
              break inf_leave;
            copy = 0;
            do {
              len = input[next + copy++];
              if (state.head && len && state.length < 65536)
                state.head.comment += String.fromCharCode(len);
            } while (len && copy < have);
            if (state.flags & 512 && state.wrap & 4)
              state.check = crc32(state.check, input, copy, next);
            have -= copy;
            next += copy;
            if (len)
              break inf_leave;
          } else if (state.head)
            state.head.comment = null;
          state.mode = HCRC;
        case HCRC:
          if (state.flags & 512) {
            while (bits < 16) {
              if (have === 0)
                break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.wrap & 4 && hold !== (state.check & 65535)) {
              strm.msg = "header crc mismatch";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          if (state.head) {
            state.head.hcrc = state.flags >> 9 & 1;
            state.head.done = true;
          }
          strm.adler = state.check = 0;
          state.mode = TYPE;
          break;
        case DICTID:
          while (bits < 32) {
            if (have === 0)
              break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          strm.adler = state.check = zswap32(hold);
          hold = 0;
          bits = 0;
          state.mode = DICT;
        case DICT:
          if (state.havedict === 0) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            return 2;
          }
          strm.adler = state.check = 1;
          state.mode = TYPE;
        case TYPE:
          if (flush === 5 || flush === 6)
            break inf_leave;
        case TYPEDO:
          if (state.last) {
            hold >>>= bits & 7;
            bits -= bits & 7;
            state.mode = CHECK;
            break;
          }
          while (bits < 3) {
            if (have === 0)
              break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.last = hold & 1;
          hold >>>= 1;
          bits -= 1;
          switch (hold & 3) {
            case 0:
              state.mode = STORED;
              break;
            case 1:
              fixedtables(state);
              state.mode = LEN_;
              if (flush === 6) {
                hold >>>= 2;
                bits -= 2;
                break inf_leave;
              }
              break;
            case 2:
              state.mode = TABLE;
              break;
            case 3:
              strm.msg = "invalid block type";
              state.mode = BAD;
          }
          hold >>>= 2;
          bits -= 2;
          break;
        case STORED:
          hold >>>= bits & 7;
          bits -= bits & 7;
          while (bits < 32) {
            if (have === 0)
              break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
            strm.msg = "invalid stored block lengths";
            state.mode = BAD;
            break;
          }
          state.length = hold & 65535;
          hold = 0;
          bits = 0;
          state.mode = COPY_;
          if (flush === 6)
            break inf_leave;
        case COPY_:
          state.mode = COPY;
        case COPY:
          copy = state.length;
          if (copy) {
            if (copy > have)
              copy = have;
            if (copy > left)
              copy = left;
            if (copy === 0)
              break inf_leave;
            output.set(input.subarray(next, next + copy), put);
            have -= copy;
            next += copy;
            left -= copy;
            put += copy;
            state.length -= copy;
            break;
          }
          state.mode = TYPE;
          break;
        case TABLE:
          while (bits < 14) {
            if (have === 0)
              break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.nlen = (hold & 31) + 257;
          hold >>>= 5;
          bits -= 5;
          state.ndist = (hold & 31) + 1;
          hold >>>= 5;
          bits -= 5;
          state.ncode = (hold & 15) + 4;
          hold >>>= 4;
          bits -= 4;
          if (state.nlen > 286 || state.ndist > 30) {
            strm.msg = "too many length or distance symbols";
            state.mode = BAD;
            break;
          }
          state.have = 0;
          state.mode = LENLENS;
        case LENLENS:
          while (state.have < state.ncode) {
            while (bits < 3) {
              if (have === 0)
                break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.lens[order[state.have++]] = hold & 7;
            hold >>>= 3;
            bits -= 3;
          }
          while (state.have < 19)
            state.lens[order[state.have++]] = 0;
          state.lencode = state.lendyn;
          state.lenbits = 7;
          opts = { bits: state.lenbits };
          ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid code lengths set";
            state.mode = BAD;
            break;
          }
          state.have = 0;
          state.mode = CODELENS;
        case CODELENS:
          while (state.have < state.nlen + state.ndist) {
            for (;; ) {
              here = state.lencode[hold & (1 << state.lenbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits)
                break;
              if (have === 0)
                break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (here_val < 16) {
              hold >>>= here_bits;
              bits -= here_bits;
              state.lens[state.have++] = here_val;
            } else {
              if (here_val === 16) {
                n = here_bits + 2;
                while (bits < n) {
                  if (have === 0)
                    break inf_leave;
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                if (state.have === 0) {
                  strm.msg = "invalid bit length repeat";
                  state.mode = BAD;
                  break;
                }
                len = state.lens[state.have - 1];
                copy = 3 + (hold & 3);
                hold >>>= 2;
                bits -= 2;
              } else if (here_val === 17) {
                n = here_bits + 3;
                while (bits < n) {
                  if (have === 0)
                    break inf_leave;
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 3 + (hold & 7);
                hold >>>= 3;
                bits -= 3;
              } else {
                n = here_bits + 7;
                while (bits < n) {
                  if (have === 0)
                    break inf_leave;
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 11 + (hold & 127);
                hold >>>= 7;
                bits -= 7;
              }
              if (state.have + copy > state.nlen + state.ndist) {
                strm.msg = "invalid bit length repeat";
                state.mode = BAD;
                break;
              }
              while (copy--)
                state.lens[state.have++] = len;
            }
          }
          if (state.mode === BAD)
            break;
          if (state.lens[256] === 0) {
            strm.msg = "invalid code -- missing end-of-block";
            state.mode = BAD;
            break;
          }
          state.lenbits = 9;
          opts = { bits: state.lenbits };
          ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid literal/lengths set";
            state.mode = BAD;
            break;
          }
          state.distbits = 6;
          state.distcode = state.distdyn;
          opts = { bits: state.distbits };
          ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
          state.distbits = opts.bits;
          if (ret) {
            strm.msg = "invalid distances set";
            state.mode = BAD;
            break;
          }
          state.mode = LEN_;
          if (flush === 6)
            break inf_leave;
        case LEN_:
          state.mode = LEN;
        case LEN:
          if (have >= 6 && left >= 258) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            inflate_fast(strm, _out);
            put = strm.next_out;
            output = strm.output;
            left = strm.avail_out;
            next = strm.next_in;
            input = strm.input;
            have = strm.avail_in;
            hold = state.hold;
            bits = state.bits;
            if (state.mode === TYPE)
              state.back = -1;
            break;
          }
          state.back = 0;
          for (;; ) {
            here = state.lencode[hold & (1 << state.lenbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits)
              break;
            if (have === 0)
              break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (here_op && (here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (;; ) {
              here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits)
                break;
              if (have === 0)
                break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state.back += here_bits;
          state.length = here_val;
          if (here_op === 0) {
            state.mode = LIT;
            break;
          }
          if (here_op & 32) {
            state.back = -1;
            state.mode = TYPE;
            break;
          }
          if (here_op & 64) {
            strm.msg = "invalid literal/length code";
            state.mode = BAD;
            break;
          }
          state.extra = here_op & 15;
          state.mode = LENEXT;
        case LENEXT:
          if (state.extra) {
            n = state.extra;
            while (bits < n) {
              if (have === 0)
                break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.length += hold & (1 << state.extra) - 1;
            hold >>>= state.extra;
            bits -= state.extra;
            state.back += state.extra;
          }
          state.was = state.length;
          state.mode = DIST;
        case DIST:
          for (;; ) {
            here = state.distcode[hold & (1 << state.distbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits)
              break;
            if (have === 0)
              break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (;; ) {
              here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits)
                break;
              if (have === 0)
                break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state.back += here_bits;
          if (here_op & 64) {
            strm.msg = "invalid distance code";
            state.mode = BAD;
            break;
          }
          state.offset = here_val;
          state.extra = here_op & 15;
          state.mode = DISTEXT;
        case DISTEXT:
          if (state.extra) {
            n = state.extra;
            while (bits < n) {
              if (have === 0)
                break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.offset += hold & (1 << state.extra) - 1;
            hold >>>= state.extra;
            bits -= state.extra;
            state.back += state.extra;
          }
          if (state.offset > state.dmax) {
            strm.msg = "invalid distance too far back";
            state.mode = BAD;
            break;
          }
          state.mode = MATCH;
        case MATCH:
          if (left === 0)
            break inf_leave;
          copy = _out - left;
          if (state.offset > copy) {
            copy = state.offset - copy;
            if (copy > state.whave) {
              if (state.sane) {
                strm.msg = "invalid distance too far back";
                state.mode = BAD;
                break;
              }
            }
            if (copy > state.wnext) {
              copy -= state.wnext;
              from = state.wsize - copy;
            } else
              from = state.wnext - copy;
            if (copy > state.length)
              copy = state.length;
            from_source = state.window;
          } else {
            from_source = output;
            from = put - state.offset;
            copy = state.length;
          }
          if (copy > left)
            copy = left;
          left -= copy;
          state.length -= copy;
          do
            output[put++] = from_source[from++];
          while (--copy);
          if (state.length === 0)
            state.mode = LEN;
          break;
        case LIT:
          if (left === 0)
            break inf_leave;
          output[put++] = state.length;
          left--;
          state.mode = LEN;
          break;
        case CHECK:
          if (state.wrap) {
            while (bits < 32) {
              if (have === 0)
                break inf_leave;
              have--;
              hold |= input[next++] << bits;
              bits += 8;
            }
            _out -= left;
            strm.total_out += _out;
            state.total += _out;
            if (state.wrap & 4 && _out)
              strm.adler = state.check = state.flags ? crc32(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out);
            _out = left;
            if (state.wrap & 4 && (state.flags ? hold : zswap32(hold)) !== state.check) {
              strm.msg = "incorrect data check";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state.mode = LENGTH;
        case LENGTH:
          if (state.wrap && state.flags) {
            while (bits < 32) {
              if (have === 0)
                break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.wrap & 4 && hold !== (state.total & 4294967295)) {
              strm.msg = "incorrect length check";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state.mode = DONE;
        case DONE:
          ret = 1;
          break inf_leave;
        case BAD:
          ret = -3;
          break inf_leave;
        case MEM:
          return -4;
        case SYNC:
        default:
          return -2;
      }
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== 4)) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
      state.mode = MEM;
      return -4;
    }
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if (state.wrap & 4 && _out)
    strm.adler = state.check = state.flags ? crc32(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out);
  strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
  if ((_in === 0 && _out === 0 || flush === 4) && ret === 0)
    ret = -5;
  return ret;
};
var inflateEnd = (strm) => {
  if (inflateStateCheck(strm))
    return -2;
  let state = strm.state;
  if (state.window)
    state.window = null;
  strm.state = null;
  return 0;
};
var inflateSetDictionary = (strm, dictionary) => {
  const dictLength = dictionary.length;
  let state;
  let dictid;
  let ret;
  if (inflateStateCheck(strm))
    return -2;
  state = strm.state;
  if (state.wrap !== 0 && state.mode !== DICT)
    return -2;
  if (state.mode === DICT) {
    dictid = 1;
    dictid = adler32(dictid, dictionary, dictLength, 0);
    if (dictid !== state.check)
      return -3;
  }
  ret = updatewindow(strm, dictionary, dictLength, dictLength);
  if (ret) {
    state.mode = MEM;
    return -4;
  }
  state.havedict = 1;
  return 0;
};
var ZStream = class {
  constructor() {
    this.input = null;
    this.next_in = 0;
    this.avail_in = 0;
    this.total_in = 0;
    this.output = null;
    this.next_out = 0;
    this.avail_out = 0;
    this.total_out = 0;
    this.msg = "";
    this.state = null;
    this.data_type = 2;
    this.adler = 0;
  }
};
var flattenChunks = (chunks) => {
  const result = new Uint8Array(chunks.reduce((len, chunk) => len + chunk.length, 0));
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
};
var toString$1 = Object.prototype.toString;
var defaultOptions$1 = {
  level: -1,
  chunkSize: 16384,
  windowBits: 15,
  memLevel: 8,
  strategy: 0,
  raw: false,
  gzip: false,
  legacyHash: false,
  dictionary: /* @__PURE__ */ new Uint8Array(0)
};
var Deflate = class {
  options;
  err;
  msg;
  ended;
  started;
  chunks;
  strm;
  result;
  constructor(options = {}) {
    this.options = Object.assign({}, defaultOptions$1, options);
    const opt = this.options;
    if (opt.raw && opt.windowBits > 0)
      opt.windowBits = -opt.windowBits;
    else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16)
      opt.windowBits += 16;
    this.err = 0;
    this.msg = "";
    this.ended = false;
    this.started = false;
    this.chunks = [];
    this.result = /* @__PURE__ */ new Uint8Array(0);
    this.strm = new ZStream;
    this.strm.avail_out = 0;
    let status = deflateInit2(this.strm, opt.level, 8, opt.windowBits, opt.memLevel, opt.strategy, opt.legacyHash);
    if (status !== 0)
      throw new Error(messages_default[status]);
    if (toString$1.call(opt.dictionary) === "[object ArrayBuffer]")
      opt.dictionary = new Uint8Array(opt.dictionary);
    const dictionary = opt.dictionary;
    if (dictionary.length) {
      if (opt.gzip)
        throw new Error("dictionary is not supported with gzip");
      status = deflateSetDictionary(this.strm, dictionary);
      if (status !== 0)
        throw new Error(messages_default[status]);
    }
  }
  push(data, flush_mode = false) {
    const strm = this.strm;
    const chunkSize = this.options.chunkSize;
    let status;
    let _flush_mode;
    if (this.ended)
      return false;
    if (typeof flush_mode === "number")
      _flush_mode = flush_mode;
    else
      _flush_mode = flush_mode === true ? 4 : 0;
    if (typeof data === "string")
      strm.input = new TextEncoder().encode(data);
    else if (toString$1.call(data) === "[object ArrayBuffer]")
      strm.input = new Uint8Array(data);
    else
      strm.input = data;
    strm.next_in = 0;
    strm.avail_in = strm.input.length;
    if (!this.started) {
      this.started = true;
      this.onStart(strm);
    }
    for (;; ) {
      if (strm.avail_out === 0) {
        strm.output = new Uint8Array(chunkSize);
        strm.next_out = 0;
        strm.avail_out = chunkSize;
      }
      if ((_flush_mode === 2 || _flush_mode === 3) && strm.avail_out <= 6) {
        this.onData(strm.output.subarray(0, strm.next_out));
        strm.avail_out = 0;
        continue;
      }
      status = deflate$1(strm, _flush_mode);
      if (status === -2)
        break;
      if (status === 1) {
        if (strm.next_out > 0)
          this.onData(strm.output.subarray(0, strm.next_out));
        status = deflateEnd(this.strm);
        break;
      }
      if (strm.avail_out === 0) {
        this.onData(strm.output);
        continue;
      }
      if (_flush_mode > 0 && strm.next_out > 0) {
        this.onData(strm.output.subarray(0, strm.next_out));
        strm.avail_out = 0;
        continue;
      }
      if (strm.avail_in === 0)
        return true;
    }
    this.err = status;
    this.msg = strm.msg || messages_default[status];
    this.ended = true;
    this.onEnd(status);
    return status === 0;
  }
  onStart(strm) {}
  onData(chunk) {
    this.chunks.push(chunk);
  }
  onEnd(status) {
    if (status === 0)
      this.result = flattenChunks(this.chunks);
    this.chunks = [];
  }
};
function deflate(input, options = {}) {
  const deflator = new Deflate(options);
  deflator.push(input, true);
  if (deflator.err)
    throw new Error(deflator.msg);
  return deflator.result;
}
function gzip(input, options = {}) {
  return deflate(input, Object.assign({}, options, { gzip: true }));
}
var toString = Object.prototype.toString;
var defaultOptions = {
  chunkSize: 1024 * 64,
  windowBits: 15,
  raw: false,
  dictionary: /* @__PURE__ */ new Uint8Array(0)
};
var Inflate = class {
  options;
  err;
  msg;
  ended;
  started;
  chunks;
  strm;
  result;
  constructor(options = {}) {
    this.options = Object.assign({}, defaultOptions, options);
    const opt = this.options;
    if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
      opt.windowBits = -opt.windowBits;
      if (opt.windowBits === 0)
        opt.windowBits = -15;
    }
    if (opt.windowBits >= 0 && opt.windowBits < 16 && !options.windowBits)
      opt.windowBits += 32;
    if (opt.windowBits > 15 && opt.windowBits < 48) {
      if ((opt.windowBits & 15) === 0)
        opt.windowBits |= 15;
    }
    this.err = 0;
    this.msg = "";
    this.ended = false;
    this.started = false;
    this.chunks = [];
    this.result = /* @__PURE__ */ new Uint8Array(0);
    this.strm = new ZStream;
    this.strm.avail_out = 0;
    let status = inflateInit2(this.strm, opt.windowBits);
    if (status !== 0)
      throw new Error(messages_default[status]);
    if (toString.call(opt.dictionary) === "[object ArrayBuffer]")
      opt.dictionary = new Uint8Array(opt.dictionary);
    const dictionary = opt.dictionary;
    if (opt.raw && dictionary.length) {
      status = inflateSetDictionary(this.strm, dictionary);
      if (status !== 0)
        throw new Error(messages_default[status]);
    }
  }
  push(data, flush_mode = false) {
    const strm = this.strm;
    const chunkSize = this.options.chunkSize;
    let status;
    let _flush_mode;
    let last_avail_out;
    if (this.ended)
      return this.err === 0;
    if (typeof flush_mode === "number")
      _flush_mode = flush_mode;
    else
      _flush_mode = flush_mode === true ? 4 : 0;
    if (toString.call(data) === "[object ArrayBuffer]")
      strm.input = new Uint8Array(data);
    else
      strm.input = data;
    strm.next_in = 0;
    strm.avail_in = strm.input.length;
    if (!this.started) {
      this.started = true;
      this.onStart(strm);
    }
    for (;; ) {
      if (strm.avail_out === 0) {
        strm.output = new Uint8Array(chunkSize);
        strm.next_out = 0;
        strm.avail_out = chunkSize;
      }
      status = inflate$1(strm, _flush_mode);
      if (status === 2) {
        const dictionary = this.options.dictionary;
        if (dictionary.length) {
          status = inflateSetDictionary(strm, dictionary);
          if (status === 0)
            status = inflate$1(strm, _flush_mode);
          else if (status === -3)
            status = 2;
        }
      }
      while (strm.avail_in > 0 && status === 1 && strm.state.wrap & 2 && strm.state.flags !== 0 && strm.input[strm.next_in] !== 0) {
        inflateReset(strm);
        status = inflate$1(strm, _flush_mode);
      }
      if (status === -2 || status === -3 || status === 2 || status === -4)
        break;
      last_avail_out = strm.avail_out;
      if (strm.next_out) {
        if (strm.avail_out === 0 || status === 1 || _flush_mode > 0) {
          this.onData(strm.output.length === strm.next_out ? strm.output : strm.output.subarray(0, strm.next_out));
          strm.avail_out = 0;
          strm.next_out = 0;
        }
      }
      if ((status === 0 || status === -5) && last_avail_out === 0)
        continue;
      if (status === 1) {
        status = inflateEnd(this.strm);
        break;
      }
      if (strm.avail_in === 0) {
        if (_flush_mode === 4) {
          status = inflateEnd(this.strm);
          if (status === 0)
            status = -5;
          break;
        }
        return true;
      }
    }
    this.err = status;
    this.msg = strm.msg || messages_default[status];
    this.ended = true;
    this.onEnd(status);
    return status === 0;
  }
  onStart(strm) {}
  onData(chunk) {
    this.chunks.push(chunk);
  }
  onEnd(status) {
    if (status === 0)
      this.result = flattenChunks(this.chunks);
    this.chunks = [];
  }
};
function inflate(input, options = {}) {
  const inflator = new Inflate(options);
  inflator.push(input, true);
  if (inflator.err)
    throw new Error(inflator.msg);
  const result = inflator.result;
  return options.toText ? new TextDecoder().decode(result) : result;
}

// src/driver/codec/pako.ts
var pakoCodec = {
  gzip: (data) => gzip(data, { level: 1 }),
  gunzip: (data) => inflate(data),
  deflate: (data, level) => deflate(data, level === undefined ? {} : { level })
};

// src/driver/js/engine.ts
var JS_SOURCE_URL = "js65-jsblock";
var FRAMES = Symbol.for("js65.jsFrames");
function setJsFrames(err, frames) {
  if (!frames.length || !err || typeof err !== "object")
    return;
  Object.defineProperty(err, FRAMES, { value: frames, configurable: true });
}
function getJsFrames(err) {
  if (!err || typeof err !== "object")
    return;
  return err[FRAMES];
}
var engine;
function setJsEngine(e) {
  engine = e;
}
function jsEngine() {
  return engine;
}

// src/driver/js/function.ts
function isCspRefusal(err) {
  return err instanceof EvalError || /content security policy|unsafe-eval|blocked by csp/i.test(err?.message ?? "");
}
function compile(code, names) {
  return new Function(...names, `"use strict";
${code}
//# sourceURL=${JS_SOURCE_URL}`);
}
var FRAME_LINE = new RegExp(`${JS_SOURCE_URL}:(\\d+):(\\d+)`);
var FRAME_NAME = /^\s*at\s+([^\s(]+)\s*\(|^\s*([^@\s]+)@/;
var PARSE_LINE = /^\s*at <parse> \(:(\d+)\)/m;
var headerOffset;
function headerLines() {
  if (headerOffset !== undefined)
    return headerOffset;
  headerOffset = 0;
  try {
    compile('throw new Error("js65 probe");', [])();
  } catch (err) {
    const m = FRAME_LINE.exec(err?.stack ?? "");
    if (m)
      headerOffset = Number(m[1]) - 1;
  }
  return headerOffset;
}
function framesOf(err) {
  const stack = err?.stack;
  if (typeof stack !== "string")
    return [];
  const offset = headerLines();
  const frames = [];
  for (const raw of stack.split(`
`)) {
    const m = FRAME_LINE.exec(raw);
    if (!m)
      continue;
    const line = Number(m[1]) - offset;
    if (line < 1)
      continue;
    const name = FRAME_NAME.exec(raw);
    frames.push({ name: name?.[1] ?? name?.[2], line, column: Number(m[2]) });
  }
  return frames;
}
var functionEngine = {
  run(code, scope) {
    const names = Object.keys(scope);
    let fn;
    try {
      fn = compile(code, names);
    } catch (err) {
      if (isCspRefusal(err)) {
        throw new Error(`JavaScript is blocked by this page's Content-Security-Policy`);
      }
      const m = PARSE_LINE.exec(err?.stack ?? "");
      const line = m ? Number(m[1]) - headerLines() : 0;
      if (line >= 1)
        setJsFrames(err, [{ line, column: 1 }]);
      throw err;
    }
    try {
      fn(...names.map((n) => scope[n]));
    } catch (err) {
      setJsFrames(err, framesOf(err));
      throw err;
    }
  }
};

// src/util.ts
function binarySearch(n, f) {
  if (!n)
    return ~0;
  const fa = f(0);
  const fb = f(n - 1);
  if (fa < 0)
    return ~0;
  if (fa === 0)
    return 0;
  if (fb > 0)
    return ~n;
  if (fb === 0)
    return n - 1;
  let a = 0;
  let b = n - 1;
  while (b - a > 1) {
    const m = a + b >> 1;
    const fm = f(m);
    if (fm > 0) {
      a = m;
    } else if (fm < 0) {
      b = m;
    } else {
      return m;
    }
  }
  return ~b;
}
function binaryInsert(arr, f, t) {
  const x = f(t);
  const index = binarySearch(arr.length, (i) => x < f(arr[i]) ? -1 : 1);
  arr.splice(~index, 0, t);
}

class SparseByteArray {
  _chunks = [];
  _length = 0;
  get length() {
    return this._length;
  }
  _find(target) {
    return binarySearch(this._chunks.length, (i) => {
      const [start, data] = this._chunks[i];
      if (target < start)
        return -1;
      if (target >= start + data.length)
        return 1;
      return 0;
    });
  }
  apply(target) {
    if (target.length < this._length)
      throw new Error(`Target too small.`);
    for (const [start, chunk] of this._chunks) {
      target.set(chunk, start);
    }
  }
  chunks() {
    return this._chunks;
  }
  get(index) {
    const i = this._find(index);
    if (i < 0)
      return;
    const [start, data] = this._chunks[i];
    return data[index - start];
  }
  set(start, ...args) {
    if (!args.length)
      return;
    const first = args[0];
    this.setInternal(start, typeof first === "number" ? args : first);
  }
  setInternal(start, values) {
    const len = values.length;
    if (!len)
      return;
    const end = start + len;
    this._length = Math.max(this._length, end);
    let i0 = this._find(start);
    let i1 = this._find(end);
    if (i0 >= 0 && i0 === i1) {
      const [s0, a0] = this._chunks[i0];
      a0.set(values, start - s0);
      return;
    }
    const prev = this._chunks[~i0 - 1];
    if (prev && prev[0] + prev[1].length === start)
      i0 = ~i0 - 1;
    if (this._chunks[~i1]?.[0] === end)
      i1 = ~i1;
    const head = i0 >= 0 ? this._chunks[i0] : undefined;
    const tail = i1 >= 0 ? this._chunks[i1] : undefined;
    const newStart = head ? head[0] : start;
    const newEnd = tail ? tail[0] + tail[1].length : end;
    const total = newEnd - newStart;
    let out;
    if (!head) {
      out = new Uint8Array(total);
    } else if (head[1].buffer.byteLength >= total) {
      out = new Uint8Array(head[1].buffer, 0, total);
    } else {
      out = new Uint8Array(new ArrayBuffer(Math.max(total, head[1].length * 2)), 0, total);
      out.set(head[1]);
    }
    out.set(values, start - newStart);
    if (tail && end < newEnd)
      out.set(tail[1].subarray(end - tail[0]), end - newStart);
    const s = i0 < 0 ? ~i0 : i0;
    let e = i1 < 0 ? ~i1 : i1;
    if (i1 >= 0)
      e++;
    this._chunks.splice(s, e - s, [newStart, out]);
  }
  splice(start, length = 1) {
    const end = start + length;
    let i0 = this._find(start);
    let i1 = this._find(end);
    let e0;
    let e1;
    if (i0 >= 0) {
      const [s0, a0] = this._chunks[i0];
      const l0 = start - s0;
      if (l0)
        e0 = [s0, a0.subarray(0, l0)];
      else
        i0 = ~i0;
    }
    if (i1 >= 0) {
      const [s1, a1] = this._chunks[i1];
      e1 = [end, a1.slice(end - s1)];
    }
    const entries = [];
    if (e0)
      entries.push(e0);
    if (e1)
      entries.push(e1);
    const s = i0 < 0 ? ~i0 : i0;
    let e = i1 < 0 ? ~i1 : i1;
    if (i1 >= 0)
      e++;
    this._chunks.splice(s, e - s, ...entries);
  }
  slice(start, end) {
    if (end <= start)
      return new Uint8Array(0);
    const i = this._find(start);
    if (i < 0)
      throw new Error(`Absent: ${start}`);
    const [s, a] = this._chunks[i];
    if (s + a.length < end)
      throw new Error(`Absent: ${s + a.length}`);
    return a.slice(start - s, end - s);
  }
  search(needle, start, end) {
    return this.pattern(needle).search(start, end);
  }
  pattern(needle) {
    if (!needle.length)
      return { search: (start = 0) => start };
    const len = needle.length;
    const charTable = new Array(256).fill(len);
    for (let i = 0;i < needle.length; i++) {
      charTable[needle[i]] = len - 1 - i;
    }
    const offsetTable = [];
    let lastPrefixPos = len;
    for (let i = len;i > 0; --i) {
      if (isPrefix(i)) {
        lastPrefixPos = i;
      }
      offsetTable[len - i] = lastPrefixPos - i + len;
      for (let i = 0;i < len - 1; ++i) {
        const slen = suffixLength(i);
        offsetTable[slen] = len - 1 - i + slen;
      }
    }
    return { search: (start = 0, end = this._length) => {
      if (!this._chunks.length || end < start)
        return -1;
      let k = this._find(start);
      let i0 = 0;
      if (k >= 0) {
        i0 = start - this._chunks[k][0];
      } else {
        k = ~k;
      }
      while (k < this._chunks.length) {
        const [offset, haystack] = this._chunks[k++];
        const i1 = Math.min(end - offset, haystack.length);
        if (i1 < 0)
          break;
        for (let i = len - 1 + i0, j;i < i1; ) {
          for (j = len - 1;needle[j] === haystack[i]; --i, --j) {
            if (j === 0)
              return i + offset;
          }
          i += Math.max(offsetTable[len - 1 - j], charTable[haystack[i]]);
        }
        i0 = 0;
      }
      return -1;
    } };
    function isPrefix(p) {
      for (let i = p, j = 0;i < len; ++i, ++j) {
        if (needle[i] !== needle[j])
          return false;
      }
      return true;
    }
    function suffixLength(p) {
      let out = 0;
      for (let i = p, j = len - 1;i >= 0 && needle[i] === needle[j]; --i, --j) {
        ++out;
      }
      return out;
    }
  }
  addOffset(offset) {
    const out = new SparseByteArray;
    for (const [start, data] of this._chunks) {
      out._chunks.push([start + offset, data.slice()]);
    }
    out._length = this._length && this._length + offset;
    return out;
  }
  toIpsPatch(target, length = 0) {
    const EOF = 4542278;
    const MAX = 65535;
    const end = Math.max(this._length, length);
    if (end > 16777216) {
      throw new Error(`IPS offsets stop at $ffffff, but the patch reaches $${(end - 1).toString(16)}`);
    }
    const parts = [Uint8Array.of(80, 65, 84, 67, 72)];
    const header = (start, size) => parts.push(Uint8Array.of(start >>> 16, start >>> 8 & 255, start & 255, size >>> 8, size & 255));
    const borrow = () => {
      const at = EOF - 1;
      const byte = this.get(at) ?? (target && (at < target.length ? target[at] : 0));
      if (byte == null) {
        throw new Error(`An IPS record cannot start at $454f46 without the unpatched ROM to take the byte before it from`);
      }
      return byte;
    };
    for (const [chunkStart, chunk] of this._chunks) {
      let start = chunkStart;
      let data = chunk;
      if (start === EOF) {
        data = new Uint8Array(chunk.length + 1);
        data[0] = borrow();
        data.set(chunk, 1);
        start--;
      }
      while (data.length) {
        let size = Math.min(data.length, MAX);
        if (start + size === EOF && size < data.length)
          size--;
        header(start, size);
        parts.push(data.subarray(0, size));
        start += size;
        data = data.subarray(size);
      }
    }
    let start = Math.max(this._length, target?.length ?? 0);
    if (start === EOF && start < length) {
      header(EOF - 1, 2);
      parts.push(Uint8Array.of(borrow(), 0));
      start++;
    }
    while (start < length) {
      let count = Math.min(length - start, MAX);
      if (start + count === EOF && start + count < length)
        count--;
      header(start, 0);
      parts.push(Uint8Array.of(count >>> 8, count & 255, 0));
      start += count;
    }
    parts.push(Uint8Array.of(69, 79, 70));
    const buffer = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let i = 0;
    for (const part of parts) {
      buffer.set(part, i);
      i += part.length;
    }
    return buffer;
  }
  toIpsHexString() {
    return toHexViewString(this.toIpsPatch());
  }
}
function toHexViewString(data) {
  const bytes = [...data];
  const lines = [];
  for (let i = 0;i < bytes.length; i += 16) {
    lines.push([
      i.toString(16).padStart(8, "0") + ":",
      ...bytes.slice(i, i + 16).map((x) => x.toString(16).padStart(2, "0"))
    ].join(" "));
  }
  return lines.join(`
`);
}
function lowerBound(arr, x) {
  const i = binarySearch(arr.length, (j) => x - arr[j]);
  return i < 0 ? ~i : i;
}

class IntervalSet {
  data = [];
  [Symbol.iterator]() {
    return this.data[Symbol.iterator]();
  }
  replace(s, e, entries) {
    this.data.splice(s, e - s, ...entries);
  }
  _find(v) {
    return binarySearch(this.data.length, (i) => {
      const entry = this.data[i];
      if (v < entry[0])
        return -1;
      if (v >= entry[1])
        return 1;
      return 0;
    });
  }
  has(x) {
    return this._find(x) >= 0;
  }
  add(start, end) {
    let i0 = this._find(start);
    let i1 = this._find(end);
    if (this.data[~i0 - 1]?.[1] === start)
      i0 = ~i0 - 1;
    if (this.data[~i1]?.[0] === end)
      i1 = ~i1;
    const entry = [start, end];
    if (i0 >= 0)
      entry[0] = this.data[i0][0];
    if (i1 >= 0)
      entry[1] = this.data[i1][1];
    const s = i0 < 0 ? ~i0 : i0;
    let e = i1 < 0 ? ~i1 : i1;
    if (i1 >= 0)
      e++;
    this.replace(s, e, [entry]);
  }
  delete(start, end) {
    let i0 = this._find(start);
    let i1 = this._find(end);
    let e0 = i0 >= 0 ? this.data[i0] : undefined;
    let e1 = i1 >= 0 ? this.data[i1] : undefined;
    if (e0) {
      e0 = [e0[0], Math.min(e0[1], start)];
      if (e0[0] === e0[1]) {
        e0 = undefined;
        i0 = ~i0;
      }
    }
    if (e1) {
      e1 = [Math.max(e1[0], end), e1[1]];
      if (e1[0] === e1[1]) {
        e1 = undefined;
        i1 = ~i1;
      }
    }
    const entries = [];
    if (e0)
      entries.push(e0);
    if (e1)
      entries.push(e1);
    const s = i0 < 0 ? ~i0 : i0;
    let e = i1 < 0 ? ~i1 : i1;
    if (i1 >= 0)
      e++;
    this.replace(s, e, entries);
  }
  tail(x) {
    let index = this._find(x);
    if (index < 0)
      index = ~index;
    const data = this.data;
    return {
      [Symbol.iterator]() {
        return this;
      },
      next() {
        if (index >= data.length)
          return { value: undefined, done: true };
        const e = data[index++];
        return { value: [Math.max(x, e[0]), e[1]], done: false };
      }
    };
  }
}
var map = new WeakMap;
function assertNever(x) {
  throw new Error(`non-exhaustive check: ${x}`);
}
var PATH_SEP = /[\\/]/;
function dirOf(p) {
  const parts = p.split(PATH_SEP);
  parts.pop();
  return parts.join("/");
}
function joinDir(base, rel) {
  const combined = !base ? rel : !rel ? base : `${base}/${rel}`;
  const root = PATH_SEP.test(combined.charAt(0)) ? "/" : "";
  const out = [];
  for (const part of combined.split(PATH_SEP)) {
    if (part === "" || part === ".")
      continue;
    if (part === ".." && out.length && out[out.length - 1] !== "..")
      out.pop();
    else
      out.push(part);
  }
  return root + out.join("/");
}

class MaxKeySizeCacheMap {
  map;
  maxKey = undefined;
  maxKeySize = 0;
  constructor(iterable) {
    this.map = new Map(iterable);
    if (iterable instanceof MaxKeySizeCacheMap) {
      this.maxKey = iterable.getLargestKey();
      this.maxKeySize = iterable.getLargestKeySize();
    } else {
      this.recalculateMaxKey();
    }
  }
  *[Symbol.iterator]() {
    yield* this.map.entries();
  }
  getLargestKey() {
    return this.maxKey;
  }
  getLargestKeySize() {
    return this.maxKeySize;
  }
  get(key) {
    return this.map.get(key);
  }
  set(key, value) {
    this.map.set(key, value);
    this.checkAndUpdateMax(key);
    return this;
  }
  delete(key) {
    const wasDeleted = this.map.delete(key);
    if (wasDeleted && Object.is(key, this.maxKey)) {
      this.recalculateMaxKey();
    }
    return wasDeleted;
  }
  clear() {
    this.map.clear();
    this.maxKey = undefined;
    this.maxKeySize = 0;
  }
  checkAndUpdateMax(key) {
    const size = this.calculateSize(key);
    if (size > this.maxKeySize) {
      this.maxKeySize = size;
      this.maxKey = key;
    }
  }
  recalculateMaxKey() {
    let largestSize = 0;
    let largestKey = undefined;
    for (const key of this.map.keys()) {
      const size = this.calculateSize(key);
      if (size > largestSize) {
        largestSize = size;
        largestKey = key;
      }
    }
    this.maxKeySize = largestSize;
    this.maxKey = largestKey;
  }
  calculateSize(key) {
    return String(key).length;
  }
}

// src/error.ts
function at(arg) {
  const s = arg.source;
  if (!s)
    return "";
  const parent = s.parent ? at({ source: s.parent }) : "";
  return `
  at ${s.file}:${s.line}:${s.column}${parent}`;
}

class SourceError extends Error {
  source;
  recorded = false;
  constructor(message, at) {
    super(message);
    this.name = "SourceError";
    const source = !at ? undefined : ("source" in at) ? at.source : ("file" in at) ? at : undefined;
    if (source)
      this.source = source;
  }
  static locate(err, source) {
    if (!source || !(err instanceof Error) || err instanceof SourceError)
      return err;
    const located = new SourceError(err.message, source);
    located.stack = err.stack;
    return located;
  }
}
function fail(message, at) {
  throw new SourceError(message, at);
}

class RecoverableError extends SourceError {
  constructor(message, source) {
    super(message, source);
    this.name = "RecoverableError";
    this.recorded = true;
  }
}

class FatalError extends SourceError {
  constructor(message, at) {
    super(message, at);
    this.name = "FatalError";
  }
}
var DEFAULT_ERROR_LIMIT = 30;

class ErrorCollector {
  messages = [];
  errorCount = 0;
  asmPass;
  limit;
  constructor(limit = DEFAULT_ERROR_LIMIT) {
    this.limit = limit;
  }
  add(level, message, source, extra) {
    this.messages.push({
      level,
      message,
      source,
      stack: new Error().stack,
      ...extra
    });
    this.checkLimit(level);
  }
  addFromException(err, source, level = "error") {
    this.messages.push({
      level,
      message: err.message,
      source: (err instanceof SourceError ? err.source : undefined) ?? source,
      stack: err.stack
    });
    this.checkLimit(level);
  }
  checkLimit(level) {
    if (level !== "error")
      return;
    if (!this.limit || ++this.errorCount < this.limit)
      return;
    const message = `too many errors (${this.limit}); stopping`;
    this.messages.push({ level: "error", message });
    const err = new FatalError(message);
    err.recorded = true;
    throw err;
  }
  getMessages() {
    return this.messages;
  }
  hasErrors() {
    return this.messages.some((m) => m.level === "error");
  }
  clear() {
    this.messages = [];
    this.errorCount = 0;
  }
  openAsmPass() {
    if (this.asmPass)
      fail("ErrorCollector: pass already open");
    this.asmPass = { messages: this.messages.length, errorCount: this.errorCount };
  }
  discardAsmPass() {
    if (!this.asmPass)
      fail("ErrorCollector: no open pass");
    this.messages.length = this.asmPass.messages;
    this.errorCount = this.asmPass.errorCount;
    this.asmPass = undefined;
  }
  flushAsmPass() {
    if (!this.asmPass)
      fail("ErrorCollector: no open pass");
    this.asmPass = undefined;
  }
  merge(messages) {
    this.messages.push(...messages);
    this.errorCount += messages.reduce((n, m) => n + (m.level === "error" ? 1 : 0), 0);
  }
}

// src/token.ts
function pullLines(source, step) {
  for (;; ) {
    const line = source.next();
    if (!step(line))
      return;
  }
}
var LB = { token: "lb" };
var LC = { token: "lc" };
var LP = { token: "lp" };
var RB = { token: "rb" };
var RC = { token: "rc" };
var RP = { token: "rp" };
var EOL = { token: "eol" };
var EOF = { token: "eof" };
var DEFINE = { token: "cs", str: ".define" };
var DOT_EOL = { token: "cs", str: ".eol" };
var ENDMACRO = { token: "cs", str: ".endmacro" };
var ENDREPEAT = { token: "cs", str: ".endrepeat" };
var LOCAL = { token: "cs", str: ".local" };
var MACRO = { token: "cs", str: ".macro" };
var REPEAT = { token: "cs", str: ".repeat" };
var SET = { token: "cs", str: ".set" };
var BYTESTR = { token: "cs", str: ".bytestr" };
var COLON = { token: "op", str: ":" };
var DCOLON = { token: "op", str: "::" };
var COMMA = { token: "op", str: "," };
var SEMI = { token: "op", str: ";" };
var STAR = { token: "op", str: "*" };
var IMMEDIATE = { token: "op", str: "#" };
var ASSIGN = { token: "op", str: "=" };
var ASSIGN_LABEL = { token: "op", str: ":=" };
var CS_TOKEN_ALIAS_MAP = new Map([
  [".addr", ".word"],
  [".bank", ".bankbyte"],
  [".byt", ".byte"],
  [".def", ".defined"],
  [".delmac", ".delmacro"],
  [".endmac", ".endmacro"],
  [".endrep", ".endrepeat"],
  [".exitmac", ".exitmacro"],
  [".fopt", ".fileopt"],
  [".forceimport", ".import"],
  [".ismnem", ".ismnemonic"],
  [".mac", ".macro"],
  [".ref", ".referencedsymbol"],
  [".referenced", ".referencedsymbol"],
  [".undef", ".undefine"]
]);
var CS_KEYWORDS = new Set([
  ".a16",
  ".a8",
  ".addr",
  ".addrsize",
  ".align",
  ".and",
  ".asciiz",
  ".asize",
  ".assert",
  ".autoimport",
  ".bank",
  ".bankbyte",
  ".bankbytes",
  ".bitand",
  ".bitnot",
  ".bitor",
  ".bitxor",
  ".blank",
  ".bss",
  ".byt",
  ".byte",
  ".byteat",
  ".bytestr",
  ".case",
  ".charmap",
  ".code",
  ".concat",
  ".cond",
  ".condes",
  ".const",
  ".constantsymbol",
  ".constructor",
  ".cpu",
  ".data",
  ".dbg",
  ".dbyt",
  ".debuginfo",
  ".def",
  ".define",
  ".defined",
  ".definedmacro",
  ".definedsymbol",
  ".delmac",
  ".delmacro",
  ".destructor",
  ".dword",
  ".else",
  ".elseif",
  ".end",
  ".endenum",
  ".endif",
  ".endmac",
  ".endmacro",
  ".endproc",
  ".endrep",
  ".endrepeat",
  ".endscope",
  ".endstruct",
  ".endunion",
  ".enum",
  ".eol",
  ".error",
  ".exitmac",
  ".exitmacro",
  ".export",
  ".exportzp",
  ".faraddr",
  ".fatal",
  ".feature",
  ".fileopt",
  ".fopt",
  ".forceimport",
  ".forceword",
  ".free",
  ".global",
  ".globalzp",
  ".hibyte",
  ".hibytes",
  ".hiword",
  ".i16",
  ".i8",
  ".ident",
  ".if",
  ".ifblank",
  ".ifconst",
  ".ifdef",
  ".ifnblank",
  ".ifnconst",
  ".ifndef",
  ".ifnref",
  ".ifnsym",
  ".ifp02",
  ".ifp4510",
  ".ifp816",
  ".ifpc02",
  ".ifpdtv",
  ".ifpsc02",
  ".ifref",
  ".ifsym",
  ".import",
  ".importzp",
  ".incbin",
  ".include",
  ".interruptor",
  ".isize",
  ".ismnem",
  ".ismnemonic",
  ".jsaction",
  ".left",
  ".linecont",
  ".list",
  ".listbytes",
  ".literal",
  ".lobyte",
  ".lobytes",
  ".local",
  ".localchar",
  ".loword",
  ".mac",
  ".macpack",
  ".macro",
  ".match",
  ".max",
  ".mid",
  ".min",
  ".mod",
  ".move",
  ".noexpand",
  ".not",
  ".null",
  ".or",
  ".org",
  ".out",
  ".p02",
  ".p4510",
  ".p816",
  ".pagelen",
  ".pagelength",
  ".paramcount",
  ".pc02",
  ".pdtv",
  ".popcharmap",
  ".popcpu",
  ".popseg",
  ".proc",
  ".psc02",
  ".pushcharmap",
  ".pushcpu",
  ".pushseg",
  ".ref",
  ".referenced",
  ".referencedsymbol",
  ".referto",
  ".refto",
  ".reloc",
  ".repeat",
  ".res",
  ".right",
  ".rodata",
  ".scope",
  ".segment",
  ".segmentprefix",
  ".set",
  ".setcpu",
  ".shl",
  ".shr",
  ".sizeof",
  ".skip",
  ".smart",
  ".sprintf",
  ".strat",
  ".string",
  ".strlen",
  ".strmap",
  ".struct",
  ".tag",
  ".tcount",
  ".time",
  ".undef",
  ".undefine",
  ".union",
  ".version",
  ".warning",
  ".word",
  ".wordat",
  ".xmatch",
  ".xor",
  ".zeropage"
]);
function eq(left, right) {
  if (!left || !right)
    return false;
  if (left.token !== right.token)
    return false;
  if (left.token === "grp")
    return false;
  if (left.str !== right.str)
    return false;
  if (left.num !== right.num)
    return false;
  return true;
}
function name(arg) {
  switch (arg.token) {
    case "num":
      return `NUM[$${arg.num.toString(16)}]`;
    case "str":
      return `STR[$${arg.str}]`;
    case "lb":
      return `[`;
    case "rb":
      return `]`;
    case "grp":
      return `{`;
    case "lc":
      return `{`;
    case "rc":
      return `}`;
    case "lp":
      return `(`;
    case "rp":
      return `)`;
    case "eol":
      return `EOL`;
    case "eof":
      return `EOF`;
    case "ident":
      return arg.str;
    case "cs":
    case "op":
      return `${(arg.rawStr ?? arg.str).toLowerCase()}`;
    default:
      assertNever(arg);
  }
}
function nameAt(arg) {
  if (!arg)
    return "at unknown";
  const token = arg;
  return (token.token ? name(token) : "") + at(arg);
}
function nameOf(arg) {
  if (!arg)
    return "unknown";
  const token = arg;
  return token.token ? name(token) : "unknown";
}
function expectEol(token, name = "end of line") {
  if (token)
    fail(`Expected ${name}: ${nameOf(token)}`, token);
}
function expect(want, token, prev) {
  if (!token) {
    if (!prev)
      throw new Error(`Expected ${name(want)}`);
    fail(`Expected ${name(want)} after ${nameOf(prev)}`, prev);
  }
  if (!eq(want, token)) {
    fail(`Expected ${name(want)}: ${nameOf(token)}`, token);
  }
}
function expectIdentifier(token, prev) {
  return expectStringToken("ident", "identifier", token, prev);
}
function expectString(token, prev) {
  return expectStringToken("str", "constant string", token, prev);
}
function expectStringToken(want, name, token, prev) {
  if (!token) {
    if (!prev)
      throw new Error(`Expected ${name}`);
    fail(`Expected ${name} after ${nameOf(prev)}`, prev);
  }
  if (token.token !== want) {
    fail(`Expected ${name}: ${nameOf(token)}`, token);
  }
  return token.str;
}
function identsFromCList(list) {
  if (!list.length)
    return [];
  const out = [];
  for (let i = 0;i <= list.length; i += 2) {
    const ident = list[i];
    if (ident?.token !== "ident") {
      if (ident)
        fail(`Expected identifier: ${nameOf(ident)}`, ident);
      const last = list[list.length - 1];
      fail(`Expected identifier after ${nameOf(last)}`, last);
    } else if (i + 1 < list.length && !eq(list[i + 1], COMMA)) {
      const sep = list[i + 1];
      fail(`Expected comma: ${nameOf(sep)}`, sep);
    }
    out.push(ident.str);
  }
  return out;
}
function findBalanced(tokens, i) {
  const open = tokens[i++].token;
  if (open !== "lp" && open !== "lb")
    throw new Error(`non-grouping token`);
  const close = open === "lp" ? "rp" : "rb";
  let depth = 1;
  for (;i < tokens.length; i++) {
    const tok = tokens[i].token;
    depth += Number(tok === open) - Number(tok === close);
    if (!depth)
      return i;
  }
  return -1;
}
function parseArgList(tokens, start = 0, end = tokens.length) {
  let arg = [];
  const args = [arg];
  let parens = 0;
  for (let i = start;i < end; i++) {
    const token = tokens[i];
    if (!parens && eq(token, COMMA)) {
      args.push(arg = []);
    } else {
      arg.push(token);
      if (eq(token, LP))
        parens++;
      if (eq(token, RP)) {
        if (--parens < 0)
          fail(`Unbalanced paren`, token);
      }
    }
  }
  return args;
}
function parseAttrList(tokens, start) {
  const out = new Map;
  let key;
  let val = [];
  if (start >= tokens.length)
    return out;
  if (!eq(tokens[start], COLON)) {
    fail(`Unexpected: ${nameOf(tokens[start])}`, tokens[start]);
  }
  for (let i = start + 1;i < tokens.length; i++) {
    const tok = tokens[i];
    if (eq(tok, COLON)) {
      if (key == null)
        fail(`Missing key`, tok);
      out.set(key, val);
      key = undefined;
      val = [];
    } else if (key == null) {
      key = expectIdentifier(tok);
    } else {
      val.push(tok);
    }
  }
  if (key != null) {
    out.set(key, val);
  } else {
    expectIdentifier(undefined, tokens[tokens.length - 1]);
  }
  return out;
}
function findComma(tokens, start) {
  const index = find(tokens, COMMA, start);
  return index < 0 ? tokens.length : index;
}
function find(tokens, want, start) {
  for (let i = start;i < tokens.length; i++) {
    if (eq(tokens[i], want))
      return i;
  }
  return -1;
}
function count(ts) {
  let total = 0;
  for (const t of ts) {
    if (t.token === "grp") {
      total += 2 + count(t.inner);
    } else {
      total++;
    }
  }
  return total;
}
function isRegister(t, reg) {
  return t.token === "ident" && t.str.toLowerCase() === reg;
}
function addrSize(tokens, start) {
  const front = tokens[start];
  if (!front)
    return;
  if (front.token === "op") {
    const match = /^([azf]):$/.exec(front.str);
    if (match)
      return { size: match[1], next: start + 1 };
  }
  if (front.token === "ident" && /^[azf]$/i.test(front.str) && eq(tokens[start + 1], COLON)) {
    return { size: front.str.toLowerCase(), next: start + 2 };
  }
  return;
}
function str(t) {
  switch (t.token) {
    case "cs":
    case "ident":
    case "str":
    case "op":
      return t.str;
  }
  fail(`Non-string token: ${nameOf(t)}`, t);
}
function sourceInfo(file, line, column, endLine, endColumn, parent, ident) {
  return { ident, file, line, column, parent, endLine, endColumn };
}
function strToken(token, str, source, rawStr, char, labelsData) {
  return { token, str, rawStr, char, source, labelsData };
}
function numToken(num, source, width, radix) {
  return { token: "num", num, source, width, radix };
}
function grpToken(inner, source) {
  return { token: "grp", inner, source };
}
function nullToken(token, source) {
  return { token, source };
}
function withRepeat(tok, repeat, end) {
  if (!tok.source)
    return tok;
  const source = { ...tok.source, repeat };
  source.repeatEnd ??= end;
  return { ...tok, source };
}
function labelsData(tok) {
  return strToken(tok.token, tok.str, tok.source, tok.rawStr, tok.char, true);
}
function reparentSource(tok, callSource) {
  const inner = tok.source;
  if (!inner && !callSource)
    return tok;
  const source = inner && callSource ? sourceInfo(inner.file, inner.line, inner.column, inner.endLine, inner.endColumn, callSource, inner.ident) : inner ?? callSource;
  if (inner?.repeat && source !== inner) {
    source.repeat = inner.repeat;
    source.repeatEnd = inner.repeatEnd;
  }
  switch (tok.token) {
    case "grp":
      return grpToken(tok.inner, source);
    case "num":
      return numToken(tok.num, source, tok.width, tok.radix);
    case "ident":
    case "op":
    case "cs":
    case "str":
      return strToken(tok.token, tok.str, source, tok.rawStr, tok.char, tok.labelsData);
    default:
      return nullToken(tok.token, source);
  }
}
var TOKENFUNCS = new Set([
  ".blank",
  ".const",
  ".defined",
  ".left",
  ".match",
  ".mid",
  ".right",
  ".tcount",
  ".xmatch"
]);

// src/expr.ts
function jsSource(e) {
  return e.source ? { source: { parent: e.source, file: "js", line: 0, column: 0 } } : {};
}
function loByte(e) {
  return { op: "<", args: [e], ...jsSource(e) };
}
function hiByte(e) {
  return { op: ">", args: [e], ...jsSource(e) };
}
function loBytes(...es) {
  return es.map(loByte);
}
function hiBytes(...es) {
  return es.map(hiByte);
}
function traverse(expr, f) {
  function rec(e) {
    const args = e.args;
    if (!args)
      return e;
    let out;
    for (let i = 0;i < args.length; i++) {
      const arg = t(args[i], e);
      if (!out && arg !== args[i])
        out = args.slice(0, i);
      if (out)
        out.push(arg);
    }
    return out ? { ...e, args: out } : e;
  }
  function t(e, p) {
    const source = e.source;
    e = f(e, rec, p);
    if (source && !e.source)
      e.source = source;
    return e;
  }
  return t(expr);
}
function traversePost(expr, f) {
  return traverse(expr, (expr, rec) => f(rec(expr)));
}
var OP_NEG = (x) => -x;
var OP_LNOT = (x) => +!x;
var OP_LOBYTE = (x) => x & 255;
var OP_HIBYTE = (x) => x >> 8 & 255;
var OP_BANKBYTE = (x) => x >>> 16 & 255;
var OP_LOWORD = (x) => x & 65535;
var OP_HIWORD = (x) => x >>> 16 & 65535;
var OP_MUL = (a, b) => a * b;
var OP_AND = (a, b) => a & b;
var OP_OR = (a, b) => a | b;
var OP_XOR = (a, b) => a ^ b;
var OP_LT = (a, b) => +(a < b);
var OP_LE = (a, b) => +(a <= b);
var OP_GT = (a, b) => +(a > b);
var OP_GE = (a, b) => +(a >= b);
var OP_EQ = (a, b) => +(a == b);
var OP_NE = (a, b) => +(a != b);
var OP_LAND = (a, b) => +(!!a && !!b);
var OP_LOR = (a, b) => +(!!a || !!b);
var OP_LXOR = (a, b) => +(!!a !== !!b);
var OP_SHL = shift((a, b) => a << b);
var OP_SHR = shift((a, b) => a >>> b);
var OP_DIV = (a, b, expr) => {
  if (b === 0)
    fail("Division by zero", expr);
  return Math.trunc(a / b);
};
var OP_MOD = (a, b, expr) => {
  if (b === 0)
    fail("Modulo operation with zero", expr);
  return a % b;
};
var OP_MATCH = (a, b) => a.num && b.num || a.str && b.str || a.sym && b.sym ? 1 : 0;
var OP_XMATCH = (a, b) => a.num !== undefined && b.num !== undefined && a.num === b.num || a.str !== undefined && b.str !== undefined && a.str === b.str || a.sym !== undefined && b.sym !== undefined && a.sym === b.sym ? 1 : 0;
function evaluate(expr, linkEnv) {
  const mapped = NAME_MAP.get(expr.op) ?? expr.op;
  switch (mapped) {
    case ".move":
    case "im":
    case "sym":
      return expr;
    case "num":
      if (expr.meta?.rel && expr.meta.org != null) {
        const { rel, ...meta } = expr.meta;
        return { op: "num", num: expr.num + meta.org, meta };
      }
      return expr;
    case ".max":
      return varArg(expr, Math.max);
    case ".min":
      return varArg(expr, Math.min);
    default:
  }
  if (expr.args?.length === 1) {
    switch (mapped) {
      case "+":
        return expr.args[0];
      case "-":
        return unary(expr, OP_NEG);
      case "~":
        return bitnot(expr);
      case "!":
        return unary(expr, OP_LNOT);
      case "<":
        return unary(expr, OP_LOBYTE);
      case ">":
        return unary(expr, OP_HIBYTE);
      case "^": {
        const arg = expr.args[0];
        const known = num(arg.meta?.bank);
        if (known)
          return known;
        if ((arg.op === "im" || arg.op === "sym") && arg.sym != null) {
          const answer = num(linkEnv?.bank(arg.sym));
          if (answer)
            return answer;
          return expr;
        } else if (arg.meta?.chunk != null) {
          const answer = num(linkEnv?.chunkBank(arg.meta.chunk));
          if (answer)
            return answer;
          return expr;
        }
        return unary(expr, OP_BANKBYTE);
      }
      case ".sizeof": {
        const arg = expr.args[0];
        return arg.op === "sym" ? expr : arg;
      }
      case ".loword":
        return unary(expr, OP_LOWORD);
      case ".hiword":
        return unary(expr, OP_HIWORD);
      case ".addrsize": {
        const arg = expr.args[0];
        if (arg.op === "im") {
          if (arg.meta?.size === 1)
            return { op: "num", num: 1, meta: size(1) };
          const answer = linkEnv?.addrSize(arg.sym);
          return { op: "num", num: answer ?? 2, meta: size(1) };
        }
        if (arg.op === "sym" && arg.sym != null) {
          const answer = linkEnv?.addrSize(arg.sym);
          return answer == null ? expr : { op: "num", num: answer, meta: size(1) };
        }
        if (arg.op !== "num")
          return expr;
        return { op: "num", num: arg.meta?.zeropage ? 1 : 2, meta: size(1) };
      }
      case ".strlen": {
        const arg = expr.args[0];
        if (arg.op !== "str")
          fail(".strlen requires a string literal", expr);
        return { op: "num", num: arg.str.length, meta: size(arg.str.length) };
      }
      default:
        fail(`Unknown unary operator: ${mapped}`, expr);
    }
  }
  switch (mapped) {
    case "str":
      return expr;
    case ".match":
      return func(expr, OP_MATCH);
    case ".xmatch":
      return func(expr, OP_XMATCH);
    case "+":
      return plus(expr);
    case "-":
      return minus(expr);
    case "*":
      return binary(expr, OP_MUL);
    case "/":
      return binaryAt(expr, OP_DIV);
    case ".mod":
      return binaryAt(expr, OP_MOD);
    case "&":
      return binary(expr, OP_AND);
    case "|":
      return binary(expr, OP_OR);
    case "^":
      return binary(expr, OP_XOR);
    case "<<":
      return binary(expr, OP_SHL);
    case ">>":
      return binary(expr, OP_SHR);
    case "<":
      return binary(expr, OP_LT);
    case "<=":
      return binary(expr, OP_LE);
    case ">":
      return binary(expr, OP_GT);
    case ">=":
      return binary(expr, OP_GE);
    case "=":
      return binary(expr, OP_EQ);
    case "<>":
      return binary(expr, OP_NE);
    case "&&":
      return binary(expr, OP_LAND);
    case "||":
      return binary(expr, OP_LOR);
    case ".xor":
      return binary(expr, OP_LXOR);
    case ".strat": {
      const [s, idx] = expr.args;
      if (s.op !== "str")
        fail(".strat requires a string literal", expr);
      if (idx.op !== "num")
        return expr;
      const ch = Array.from(s.str)[idx.num];
      if (ch === undefined)
        fail(".strat index out of range", expr);
      return { op: "num", num: ch.codePointAt(0), meta: size(ch.codePointAt(0)) };
    }
    default:
      fail(`Unknown operator: ${mapped} Expr: ${JSON.stringify(expr)}`, expr);
  }
}
function symbols(expr, out = []) {
  for (const arg of expr.args || []) {
    symbols(arg, out);
  }
  if (expr.op === "sym" && expr.sym)
    out.push(expr.sym);
  return out;
}
function identifier(expr) {
  if (expr.op === "sym" && expr.sym)
    return expr.sym;
  fail(`Expected identifier but got op: ${expr.op}`, expr);
}
function parseOnly(tokens, index = 0, symbols, charEncoder) {
  const [expr, i] = parse(tokens, index, symbols, charEncoder);
  if (i < tokens.length) {
    parse(tokens, index, symbols, charEncoder);
    fail(`Garbage after expression: ${nameOf(tokens[i])}`, tokens[i]);
  } else if (!expr) {
    throw new Error(`No expression?`);
  }
  return expr;
}
function parse(tokens, index = 0, symbols, charEncoder) {
  const ops = [];
  const exprs = [];
  function popOp() {
    const [op, [, , arity]] = ops.pop();
    const args = exprs.splice(exprs.length - arity, arity);
    if (args.length !== arity)
      fail(`shunting parse failed? ${nameOf(tokens[i])}`, tokens[i]);
    exprs.push(fixSize({ op, args }));
  }
  let val = true;
  let i = index;
  for (;i < tokens.length; i++) {
    const front = tokens[i];
    if (val) {
      if (front.token === "cs" || front.token === "op") {
        const str = collapseSigns(front.str, true);
        if (!str)
          continue;
        const mapped = NAME_MAP.get(str);
        const prefix = PREFIXOPS.get(mapped ?? str);
        if (prefix) {
          ops.push([str, prefix]);
        } else if (front.token === "cs") {
          const op = front.str;
          if (!FUNCTIONS.has(op)) {
            fail(`No such function: ${nameOf(front)}`, front);
          }
          const next = tokens[i + 1];
          if (next?.token !== "lp") {
            fail(`Bad funcall: ${nameOf(next ?? front)}`, next ?? front);
          }
          const close = findBalanced(tokens, i + 1);
          if (close < 0) {
            fail(`Never closed: ${nameOf(next)}`, next);
          }
          const args = [];
          const argSymbols = op === ".sizeof" ? undefined : symbols;
          for (const arg of parseArgList(tokens, i + 2, close)) {
            args.push(parseOnly(arg, 0, argSymbols, charEncoder));
          }
          i = close;
          exprs.push(fixSize({ op, args }));
          val = false;
        } else if (eq(front, STAR)) {
          exprs.push({ op: "sym", sym: "*" });
          val = false;
        } else {
          fail(`Unknown prefix operator: ${nameOf(front)}`, front);
        }
      } else if (front.token === "lp") {
        const close = findBalanced(tokens, i);
        if (close < 0) {
          fail(`No close paren: ${nameOf(front)}`, front);
        }
        const e = parseOnly(tokens.slice(i + 1, close), 0, symbols, charEncoder);
        exprs.push(e);
        i = close;
        val = false;
      } else if (front.token === "ident") {
        const expr = symbols?.get(front.str)?.expr;
        if (expr) {
          exprs.push(expr);
        } else {
          const ref = { op: "sym", sym: front.str };
          if (symbols?.zeropage?.(front.str))
            ref.meta = { zeropage: true };
          exprs.push(ref);
        }
        symbols?.ref?.(front.str, front.source);
        val = false;
      } else if (front.token === "num") {
        const num = front.num;
        exprs.push({ op: "num", num, meta: size(num) });
        val = false;
      } else if (front.token === "str") {
        const s = front.str;
        const chars = front.char ? Array.from(s) : undefined;
        if (chars) {
          if (chars.length !== 1) {
            fail(`Character literal must be one character: '${s}'`, front);
          }
          const num = charEncoder?.(chars[0]) ?? chars[0].codePointAt(0);
          exprs.push({ op: "num", num, meta: size(num) });
        } else {
          exprs.push({ op: "str", str: s, meta: { size: s.length } });
        }
        val = false;
      } else {
        fail(`Bad expression token: ${nameOf(front)}`, front);
      }
    } else {
      if (eq(front, COMMA)) {
        break;
      }
      if (front.token === "cs" || front.token === "op") {
        const str = collapseSigns(front.str, false);
        const mapped = NAME_MAP.get(str);
        const op = BINOPS.get(mapped ?? str);
        if (!op)
          break;
        while (ops.length) {
          const top = ops[ops.length - 1];
          const cmp = compareOp(top[1], op);
          if (cmp < 0)
            break;
          if (cmp === 0) {
            fail(`Mixing ${top[0]} and ${front.str} needs explicit parens.`, front);
          }
          popOp();
        }
        ops.push([str, op]);
        val = true;
      } else {
        break;
      }
    }
  }
  while (ops.length)
    popOp();
  if (!tokens[index])
    throw new Error(`No token at ${index}:
${tokens.map((t) => "  " + nameAt(t) + `
`)}`);
  if (exprs.length !== 1)
    fail(`expression parse failed: nonunique result ${nameOf(tokens[index])}`, tokens[index]);
  if (!exprs[0].source && tokens[index].source)
    exprs[0].source = tokens[index].source;
  return [exprs[0], i];
}
var SIGN_RUN = /^([-+])\1+$/;
function collapseSigns(str, unary) {
  if (str.length < 2)
    return str;
  const c = str.charCodeAt(0);
  if (c !== 45 && c !== 43)
    return str;
  if (!SIGN_RUN.test(str))
    return str;
  const negations = str[0] === "-" ? unary ? str.length : str.length - 1 : 0;
  if (negations % 2)
    return "-";
  return unary ? "" : "+";
}
function i32(x) {
  return x | 0;
}
function shift(f) {
  return (x, n) => n >>> 0 >= 32 ? 0 : f(x, n);
}
function num(num) {
  if (num == null)
    return;
  return { op: "num", num, meta: size(num) };
}
function unary(expr, f) {
  const arg = expr.args[0];
  if (!isAbs(arg))
    return expr;
  const num = i32(f(i32(arg.num)));
  return { op: "num", num, meta: size(num) };
}
function bitnot(expr) {
  const arg = expr.args[0];
  if (!isAbs(arg))
    return expr;
  const width = Number(arg.meta?.size) || size(i32(arg.num)).size;
  if (width >= 4)
    return unary(expr, (x) => ~x);
  const mask = 2 ** (width << 3) - 1;
  const num = i32(~i32(arg.num)) & mask;
  return { op: "num", num, meta: sizeMeta(width) };
}
function binary(expr, f) {
  const [a, b] = expr.args;
  if (!isAbs(a) || !isAbs(b))
    return expr;
  const num = i32(f(i32(a.num), i32(b.num)));
  return { op: "num", num, meta: size(num) };
}
function binaryAt(expr, f) {
  const [a, b] = expr.args;
  if (!isAbs(a) || !isAbs(b))
    return expr;
  const num = i32(f(i32(a.num), i32(b.num), expr));
  return { op: "num", num, meta: size(num) };
}
function varArg(expr, f) {
  const args = expr.args;
  if (!args.length || !args.every(isAbs))
    return expr;
  const num = i32(f(...args.map((a) => i32(a.num))));
  return { op: "num", num, meta: size(num) };
}
function func(expr, f) {
  const [a, b] = expr.args;
  const num = f(a, b);
  return { op: "num", num, meta: size(num) };
}
function plus(expr) {
  const [a, b] = expr.args;
  if (a.op !== "num" || b.op !== "num")
    return expr;
  const out = { op: "num", num: a.num + b.num };
  if (a.meta || b.meta) {
    if (a.meta?.rel && b.meta?.rel)
      return expr;
    if (a.meta?.rel) {
      out.meta = a.meta;
    } else if (b.meta?.rel) {
      out.meta = b.meta;
    }
  }
  if (!out.meta?.rel && out.meta?.size == null) {
    out.meta = size(out.num);
  }
  return carryZeropage(out, "+", [a, b]);
}
function minus(expr) {
  const [a, b] = expr.args;
  if (a.op !== "num" || b.op !== "num")
    return expr;
  const out = { op: "num", num: a.num - b.num };
  const isBranch = expr.meta?.branch;
  if (b.meta?.rel) {
    if (a.meta?.rel && a.meta.chunk === b.meta.chunk) {
      const sz = size(out.num).size;
      out.meta = isBranch ? { size: sz, branch: true } : sizeMeta(sz);
      return out;
    }
    return expr;
  }
  if (a.meta?.rel)
    out.meta = a.meta;
  if (!out.meta?.rel && out.meta?.size == null) {
    out.meta = size(out.num);
  }
  if (isBranch && out.op === "num") {
    out.meta = out.meta ? { ...out.meta, branch: true } : { branch: true };
  }
  return carryZeropage(out, "-", [a, b]);
}
function carryZeropage(out, op, args) {
  if (out.meta?.zeropage || !isZeropage(op, args))
    return out;
  return { ...out, meta: { ...out.meta, zeropage: true } };
}
function isAbs(expr) {
  return expr.op === "num" && !expr.meta?.rel;
}
function compareOp(top, next) {
  if (top[0] > next[0])
    return 1;
  if (top[0] < next[0])
    return -1;
  if (top[1] !== next[1])
    return 0;
  return top[1];
}
var BINARY = 2;
var UNARY = 1;
var LEFT = 1;
var RIGHT = -1;
var BINOPS = new Map([
  ["*", [6, LEFT, BINARY]],
  ["/", [6, LEFT, BINARY]],
  [".mod", [6, LEFT, BINARY]],
  ["&", [6, LEFT, BINARY]],
  ["^", [6, LEFT, BINARY]],
  ["<<", [6, LEFT, BINARY]],
  [">>", [6, LEFT, BINARY]],
  ["+", [5, LEFT, BINARY]],
  ["-", [5, LEFT, BINARY]],
  ["|", [5, LEFT, BINARY]],
  ["<", [4, LEFT, BINARY]],
  ["<=", [4, LEFT, BINARY]],
  [">", [4, LEFT, BINARY]],
  [">=", [4, LEFT, BINARY]],
  ["=", [4, LEFT, BINARY]],
  ["<>", [4, LEFT, BINARY]],
  ["&&", [3, LEFT, BINARY]],
  [".xor", [3, LEFT, BINARY]],
  ["||", [2, LEFT, BINARY]]
]);
var PREFIXOPS = new Map([
  ["+", [7, RIGHT, UNARY]],
  ["-", [7, RIGHT, UNARY]],
  ["~", [7, RIGHT, UNARY]],
  ["<", [7, RIGHT, UNARY]],
  [">", [7, RIGHT, UNARY]],
  ["^", [7, RIGHT, UNARY]],
  ["!", [1, RIGHT, UNARY]]
]);
var FUNCTIONS = new Set([
  ".byteat",
  ".wordat",
  ".match",
  ".xmatch",
  ".max",
  ".min",
  ".sizeof",
  ".hiword",
  ".loword",
  ".strlen",
  ".strat",
  ".addrsize"
]);
var NAME_MAP = new Map([
  [".bitand", "&"],
  [".bitxor", "^"],
  [".bitor", "|"],
  [".shl", "<<"],
  [".shr", ">>"],
  [".and", "&&"],
  [".or", "||"],
  [".bitnot", "~"],
  [".lobyte", "<"],
  [".hibyte", ">"],
  [".bankbyte", "^"],
  [".not", "!"]
]);
var SIZE_TRANSFORMS = new Map([
  ["^", (...args) => args.length === 1 ? 1 : Math.max(...args)],
  ["<", () => 1],
  [">", () => 1],
  ["!", () => 1],
  ["~", (a) => a],
  ["<=", () => 1],
  [">=", () => 1],
  ["<>", () => 1],
  ["=", () => 1],
  ["&", Math.max],
  ["&&", Math.max],
  ["|", Math.max],
  ["||", Math.max],
  [".xor", Math.max],
  [".max", Math.max],
  [".min", Math.max],
  [".hiword", () => 2],
  [".loword", () => 2]
]);
function fixSize(expr) {
  const xform = SIZE_TRANSFORMS.get(expr.op);
  const args = expr.args;
  const additive = expr.op === "+" || expr.op === "-";
  const size = !xform ? byteOffsetSize(additive, args) : args.length === 1 ? xform(Number(args[0].meta?.size)) : args.length === 2 ? xform(Number(args[0].meta?.size), Number(args[1].meta?.size)) : xform(...args.map((e) => Number(e.meta?.size)));
  const zp = additive && isZeropage(expr.op, expr.args);
  if (size && zp) {
    expr.meta = { ...expr.meta, size, zeropage: true };
  } else if (size) {
    expr.meta = expr.meta ? { ...expr.meta, size } : sizeMeta(size);
  } else if (zp) {
    expr.meta = { ...expr.meta, zeropage: true };
  }
  return expr;
}
function byteOffsetSize(additive, args) {
  if (!additive || args.length !== 2 || !args.some(isByteOf))
    return;
  if (!args.every((a) => a.op === "num" || isByteOf(a)))
    return;
  return Math.max(Number(args[0].meta?.size), Number(args[1].meta?.size)) || undefined;
}
function isByteOf(expr) {
  return expr.args?.length === 1 && (expr.op === "<" || expr.op === ">" || expr.op === "^");
}
function isAddress(expr) {
  switch (expr.op) {
    case "sym":
    case "im":
      return true;
    case "num":
      return Boolean(expr.meta?.rel || expr.meta?.zeropage || expr.meta?.chunk != null);
    case "+":
    case "-":
      return (expr.args ?? []).some(isAddress);
    default:
      return false;
  }
}
function isZeropage(op, args) {
  if (args.length === 1)
    return op === "+" && Boolean(args[0].meta?.zeropage);
  if (op === "-" && isAddress(args[1]))
    return false;
  const addrs = args.filter(isAddress);
  return addrs.length === 1 && Boolean(addrs[0].meta?.zeropage);
}
var SIZE_METAS = [
  Object.freeze({ size: 0 }),
  Object.freeze({ size: 1 }),
  Object.freeze({ size: 2 }),
  Object.freeze({ size: 3 }),
  Object.freeze({ size: 4 })
];
function sizeMeta(width) {
  return SIZE_METAS[width] ?? Object.freeze({ size: width });
}
function size(num) {
  return 0 <= num && num < 256 ? SIZE_METAS[1] : SIZE_METAS[2];
}
function fits(num, size, isBranch = false) {
  const bits = size << 3;
  const min = -(2 ** (bits - 1));
  const max = (isBranch ? 2 ** (bits - 1) : 2 ** bits) - 1;
  return num >= min && num <= max;
}
function rangeErrorMessage(num, size, isBranch = false, at = "") {
  const bits = size << 3;
  if (isBranch) {
    return `Branch out of range: offset ${num}${at} (valid range: ${-(2 ** (bits - 1))} to ${2 ** (bits - 1) - 1})`;
  }
  const name = ["byte", "word", "farword", "dword"][size - 1] ?? `${size} bytes`;
  return `Not a ${name}: ${num < 0 ? num : `$${num.toString(16)}`}${at}`;
}

// src/frontend/actions.ts
function toSourceInfo(source) {
  if (!source)
    return;
  return { file: source.file, line: source.line, column: 0 };
}
function toValueExpr(v) {
  return typeof v === "number" ? { op: "num", num: v } : v;
}
function runActions(asm, actions, runCode) {
  for (const action of actions) {
    asm.setSource(toSourceInfo(action.source));
    switch (action.action) {
      case "code":
        if (!runCode) {
          asm.fail(`code actions are not supported here`);
        }
        runCode(asm, action.code, action.name);
        break;
      case "label":
        asm.label(action.label);
        break;
      case "byte":
        asm.byte(...action.bytes);
        break;
      case "word":
        asm.word(...action.words);
        break;
      case "hibytes":
        asm.byte(...hiBytes(...action.values.map(toValueExpr)));
        break;
      case "lobytes":
        asm.byte(...loBytes(...action.values.map(toValueExpr)));
        break;
      case "literal":
        asm.byteInternal(action.values, new MaxKeySizeCacheMap);
        break;
      case "org":
        asm.org(action.addr, action.name);
        break;
      case "segment":
        asm.segment(...Array.isArray(action.name) ? action.name : [action.name]);
        break;
      case "reloc":
        asm.reloc(action.name);
        break;
      case "export":
        asm.export(action.name);
        break;
      case "exportzp":
        asm.exportzp(...action.names);
        break;
      case "import":
        asm.import(...action.names);
        break;
      case "importzp":
        asm.importzp(...action.names);
        break;
      case "global":
        asm.global(...action.names);
        break;
      case "globalzp":
        asm.globalzp(...action.names);
        break;
      case "align":
        asm.align(action.boundary, action.fill);
        break;
      case "res":
        asm.res(action.count, action.value);
        break;
      case "charmap":
        asm.charMap(action.code, action.target);
        break;
      case "strmap":
        asm.strMap(action.key, action.bytes);
        break;
      case "pushcharmap":
        asm.pushCharmap();
        break;
      case "popcharmap":
        asm.popCharmap();
        break;
      case "assign": {
        const value = typeof action.value === "string" ? parseInt(action.value, 10) : action.value;
        asm.assign(action.name, value);
        break;
      }
      case "set": {
        const value = typeof action.value === "string" ? parseInt(action.value, 10) : action.value;
        asm.set(action.name, value);
        break;
      }
      case "free":
        asm.free(action.size);
        break;
      default:
        console.warn(`Unknown action type:`, action);
    }
  }
}

// src/base64.ts
function eq2(x, y) {
  return 0 - (x ^ y) >> 16 & 65535 ^ 65535;
}
function gt(x, y) {
  return y - x >> 8 & 65535;
}
function lt(x, y) {
  return gt(y, x);
}
function ge(x, y) {
  return gt(y, x) ^ 65535;
}
function le(x, y) {
  return ge(y, x);
}
function byteToCharOriginal(x) {
  const c = lt(x, 26) & x + 65 | ge(x, 26) & lt(x, 52) & x + (97 - 26) | ge(x, 52) & lt(x, 62) & x + (48 - 52) | eq2(x, 62) & 43 | eq2(x, 63) & 47;
  return String.fromCharCode(c);
}
function charToByteOriginal(c) {
  const x = ge(c, 65) & le(c, 90) & c - 65 | ge(c, 97) & le(c, 122) & c - (97 - 26) | ge(c, 48) & le(c, 57) & c - (48 - 52) | eq2(c, 43) & 62 | eq2(c, 47) & 63;
  return x | eq2(x, 0) & (eq2(c, 65) ^ 65535);
}
function bin2Base64(bin, padding, byteToChar) {
  let bin_len = bin.length;
  let nibbles = Math.floor(bin_len / 3);
  let remainder = bin_len - 3 * nibbles;
  let b64_len = nibbles * 4;
  if (remainder) {
    if (padding) {
      b64_len += 4;
    } else {
      b64_len += 2 + (remainder >> 1);
    }
  }
  let b64 = "";
  let acc = 0, acc_len = 0, bin_pos = 0;
  while (bin_pos < bin_len) {
    acc = (acc << 8) + bin[bin_pos++] & 4095;
    acc_len += 8;
    while (acc_len >= 6) {
      acc_len -= 6;
      b64 += byteToChar(acc >> acc_len & 63);
    }
  }
  if (acc_len > 0) {
    b64 += byteToChar(acc << 6 - acc_len & 63);
  }
  while (b64.length < b64_len) {
    b64 += "=";
  }
  return b64;
}
function skipPadding(b64, ignore, padding_len) {
  let i = 0;
  while (padding_len > 0) {
    let c = b64[i++];
    if (c == "=") {
      padding_len--;
    } else if (!ignore || ignore.indexOf(c) < 0) {
      throw new Error("Invalid base64 padding");
    }
  }
  if (i !== b64.length) {
    throw new Error("Invalid base64 padding length");
  }
}
function base642Bin(b64, padding, ignore, charToByte) {
  let b64_len = b64.length;
  let bin = new Uint8Array(Math.ceil(b64_len * 3 / 4));
  let acc = 0, acc_len = 0, bin_len = 0, b64_pos = 0;
  while (b64_pos < b64_len) {
    const c = b64[b64_pos];
    const d = charToByte(c.charCodeAt(0));
    if (d == 65535) {
      if (ignore && ignore.indexOf(c) >= 0) {
        b64_pos++;
        continue;
      }
      break;
    }
    acc = (acc << 6) + d & 4095;
    acc_len += 6;
    if (acc_len >= 8) {
      acc_len -= 8;
      bin[bin_len++] = acc >> acc_len & 255;
    }
    b64_pos++;
  }
  if (acc_len > 4 || (acc & (1 << acc_len) - 1) != 0) {
    throw new Error("Non-canonical base64 encoding");
  }
  if (padding) {
    skipPadding(b64.slice(b64_pos), ignore, acc_len / 2);
  }
  return new Uint8Array(bin.buffer, 0, bin_len);
}

class Base64Codec {
  _ignore = null;
  _padding = false;
  _charToByte;
  _byteToChar;
  constructor(padding = false, ignore = null, charToByte, byteToChar) {
    this._padding = padding;
    this._ignore = ignore;
    this._charToByte = charToByte;
    this._byteToChar = byteToChar;
  }
  encode(data) {
    return bin2Base64(data, this._padding, this._byteToChar);
  }
  decode(data) {
    return base642Bin(data, this._padding, this._ignore, this._charToByte);
  }
}

class Base64 extends Base64Codec {
  constructor(padding = true, ignore = null) {
    super(padding, ignore, charToByteOriginal, byteToCharOriginal);
  }
}

// src/cpu.ts
function allCapitalizations(mnemonics) {
  const out = new Set;
  for (const m of mnemonics) {
    const upper = m.toUpperCase();
    if (m.length > 4 || upper.length !== m.length) {
      throw new Error(`Mnemonic not expandable by case: ${m}`);
    }
    for (let mask = 0;mask < 1 << m.length; mask++) {
      let s = "";
      for (let i = 0;i < m.length; i++) {
        s += mask >> i & 1 ? upper[i] : m[i];
      }
      out.add(s);
    }
  }
  return out;
}

class AbstractCpu {
  table;
  reverse;
  names;
  constructor(table) {
    this.table = table;
    const reverse = [];
    for (const [mnemonic, ops] of Object.entries(table)) {
      for (const [mode, op] of Object.entries(ops)) {
        reverse[op] = [mnemonic, mode];
      }
    }
    this.reverse = reverse;
    this.names = allCapitalizations(Object.keys(table));
  }
  op(mnemonic) {
    return this.table[mnemonic];
  }
  disasm(byte) {
    const result = this.reverse[byte];
    return result && [...result];
  }
  argLen(mode) {
    switch (mode) {
      case "acc":
      case "imp":
        return 0;
      case "imm":
      case "rel":
      case "zpg":
      case "zpx":
      case "zpy":
      case "iny":
      case "inx":
        return 1;
      case "abs":
      case "abx":
      case "aby":
      case "ind":
        return 2;
    }
  }
  format(mode, arg) {
    if (mode === "acc" || mode === "imp")
      return "";
    if (typeof arg === "number") {
      if (mode === "rel") {
        const displacement = (arg > 127 ? arg - 256 : arg) + 2;
        if (displacement < 0) {
          arg = `*-${-displacement}`;
        } else if (displacement > 0) {
          arg = `*+${displacement}`;
        } else {
          arg = "*";
        }
      } else if (mode.startsWith("zp") || mode === "iny" || mode === "imm") {
        arg = `$${(arg & 255).toString(16).padStart(2, "0")}`;
      } else {
        arg = `$${(arg & 65535).toString(16).padStart(4, "0")}`;
      }
    }
    switch (mode) {
      case "imm":
        return `#${arg}`;
      case "rel":
        return arg;
      case "zpg":
        return arg;
      case "abs":
        return arg;
      case "zpx":
        return `${arg},x`;
      case "abx":
        return `${arg},x`;
      case "zpy":
        return `${arg},y`;
      case "aby":
        return `${arg},y`;
      case "iny":
        return `(${arg}),y`;
      case "ind":
        return `(${arg})`;
      case "inx":
        return `(${arg},x)`;
    }
  }
}
var Cpu;
((Cpu) => {
  Cpu.P02 = new AbstractCpu({
    adc: {
      abs: 109,
      abx: 125,
      aby: 121,
      imm: 105,
      iny: 113,
      inx: 97,
      zpg: 101,
      zpx: 117
    },
    and: {
      abs: 45,
      abx: 61,
      aby: 57,
      imm: 41,
      iny: 49,
      inx: 33,
      zpg: 37,
      zpx: 53
    },
    asl: { abs: 14, abx: 30, acc: 10, imp: 10, zpg: 6, zpx: 22 },
    bcc: { rel: 144 },
    bcs: { rel: 176 },
    beq: { rel: 240 },
    bit: { abs: 44, zpg: 36 },
    bmi: { rel: 48 },
    bne: { rel: 208 },
    bpl: { rel: 16 },
    brk: { imp: 0 },
    bvc: { rel: 80 },
    bvs: { rel: 112 },
    clc: { imp: 24 },
    cld: { imp: 216 },
    cli: { imp: 88 },
    clv: { imp: 184 },
    cmp: {
      abs: 205,
      abx: 221,
      aby: 217,
      imm: 201,
      iny: 209,
      inx: 193,
      zpg: 197,
      zpx: 213
    },
    cpx: { abs: 236, imm: 224, zpg: 228 },
    cpy: { abs: 204, imm: 192, zpg: 196 },
    dec: { abs: 206, abx: 222, zpg: 198, zpx: 214 },
    dex: { imp: 202 },
    dey: { imp: 136 },
    eor: {
      abs: 77,
      abx: 93,
      aby: 89,
      imm: 73,
      iny: 81,
      inx: 65,
      zpg: 69,
      zpx: 85
    },
    inc: { abs: 238, abx: 254, zpg: 230, zpx: 246 },
    inx: { imp: 232 },
    iny: { imp: 200 },
    jmp: { abs: 76, ind: 108 },
    jsr: { abs: 32 },
    lda: {
      abs: 173,
      abx: 189,
      aby: 185,
      imm: 169,
      iny: 177,
      inx: 161,
      zpg: 165,
      zpx: 181
    },
    ldx: { abs: 174, aby: 190, imm: 162, zpg: 166, zpy: 182 },
    ldy: { abs: 172, abx: 188, imm: 160, zpg: 164, zpx: 180 },
    lsr: { abs: 78, abx: 94, acc: 74, imp: 74, zpg: 70, zpx: 86 },
    nop: { imp: 234 },
    ora: {
      abs: 13,
      abx: 29,
      aby: 25,
      imm: 9,
      iny: 17,
      inx: 1,
      zpg: 5,
      zpx: 21
    },
    pha: { imp: 72 },
    php: { imp: 8 },
    pla: { imp: 104 },
    plp: { imp: 40 },
    rol: { abs: 46, abx: 62, acc: 42, imp: 42, zpg: 38, zpx: 54 },
    ror: { abs: 110, abx: 126, acc: 106, imp: 106, zpg: 102, zpx: 118 },
    rti: { imp: 64 },
    rts: { imp: 96 },
    sbc: {
      abs: 237,
      abx: 253,
      aby: 249,
      imm: 233,
      iny: 241,
      inx: 225,
      zpg: 229,
      zpx: 245
    },
    sec: { imp: 56 },
    sed: { imp: 248 },
    sei: { imp: 120 },
    sta: {
      abs: 141,
      abx: 157,
      aby: 153,
      iny: 145,
      inx: 129,
      zpg: 133,
      zpx: 149
    },
    stx: { abs: 142, zpg: 134, zpy: 150 },
    sty: { abs: 140, zpg: 132, zpx: 148 },
    tax: { imp: 170 },
    tay: { imp: 168 },
    tsx: { imp: 186 },
    txa: { imp: 138 },
    txs: { imp: 154 },
    tya: { imp: 152 },
    slo: {
      abs: 15,
      abx: 31,
      aby: 27,
      zpg: 7,
      zpx: 23,
      inx: 3,
      iny: 19
    },
    rla: {
      abs: 47,
      abx: 63,
      aby: 59,
      zpg: 39,
      zpx: 55,
      inx: 35,
      iny: 51
    },
    sre: {
      abs: 79,
      abx: 95,
      aby: 91,
      zpg: 71,
      zpx: 87,
      inx: 67,
      iny: 83
    },
    rra: {
      abs: 111,
      abx: 127,
      aby: 123,
      zpg: 103,
      zpx: 119,
      inx: 99,
      iny: 115
    },
    sax: { abs: 143, zpg: 135, zpy: 151, inx: 131 },
    lax: {
      abs: 175,
      aby: 191,
      zpg: 167,
      zpy: 183,
      inx: 163,
      iny: 179
    },
    dcp: {
      abs: 207,
      abx: 223,
      aby: 219,
      zpg: 199,
      zpx: 215,
      inx: 195,
      iny: 211
    },
    isc: {
      abs: 239,
      abx: 255,
      aby: 251,
      zpg: 231,
      zpx: 247,
      inx: 227,
      iny: 243
    },
    alr: { imm: 75 },
    arr: { imm: 107 },
    axs: { imm: 203 },
    tas: { aby: 155 },
    shy: { abx: 156 },
    shx: { aby: 158 },
    ahx: { aby: 159, iny: 147 },
    anc: { imm: 43 },
    las: { aby: 187 }
  });
})(Cpu ||= {});

// src/module.ts
var RESERVED_SEGMENT_PREFIX = "@";
var ANON_SEGMENT_PREFIX = "@anon@";
function anonSegmentName(file, line, hash) {
  return `${ANON_SEGMENT_PREFIX}${file}:${line ?? ""}:${hash}`;
}
var Segment;
((Segment) => {
  function isAnon(s) {
    return (typeof s === "string" ? s : s.name).startsWith(ANON_SEGMENT_PREFIX);
  }
  Segment.isAnon = isAnon;
  function anonSource(s) {
    const name = typeof s === "string" ? s : s.name;
    if (!isAnon(name))
      return;
    const body = name.substring(ANON_SEGMENT_PREFIX.length);
    const hashAt = body.lastIndexOf(":");
    if (hashAt < 0)
      return;
    const lineAt = body.lastIndexOf(":", hashAt - 1);
    if (lineAt < 0)
      return;
    const file = body.substring(0, lineAt);
    const lineStr = body.substring(lineAt + 1, hashAt);
    if (!file)
      return;
    if (lineStr && !/^\d+$/.test(lineStr))
      return;
    return { file, line: lineStr ? Number(lineStr) : undefined };
  }
  Segment.anonSource = anonSource;
  function merge(a, b) {
    const seg = { ...a, ...b };
    const free = [...a.free || [], ...b.free || []];
    if (free.length)
      seg.free = free;
    return seg;
  }
  Segment.merge = merge;
  function includesOrg(s, addr) {
    if (s.memory == null || s.size == null)
      return false;
    return addr >= s.memory && addr < s.memory + s.size;
  }
  Segment.includesOrg = includesOrg;
})(Segment ||= {});
var MODULE_FORMAT_VERSION = 6;
var DEBUG_LINE_ASM = 0;
var DEBUG_LINE_EXT = 1;
var DEBUG_LINE_MACRO = 2;
var DEBUG_RUN_UNTYPED = -1;
var DEBUG_RUN_CODE = -2;

// src/buffer.ts
class State {
  line;
  column;
  pos;
  match;
  matchText;
  matchLine;
  matchColumn;
  constructor(line, column, pos, match, matchText, matchLine, matchColumn) {
    this.line = line;
    this.column = column;
    this.pos = pos;
    this.match = match;
    this.matchText = matchText;
    this.matchLine = matchLine;
    this.matchColumn = matchColumn;
  }
}

class Buffer {
  content;
  line;
  column;
  pos = 0;
  rawMatch;
  matchText;
  matchLine = 0;
  matchColumn = 0;
  constructor(content, line = 1, column = 0) {
    this.content = content;
    this.line = line;
    this.column = column;
  }
  record(match) {
    this.rawMatch = match;
    this.matchText = match[0];
    this.matchLine = this.line;
    this.matchColumn = this.column;
  }
  recordStr(s) {
    this.rawMatch = undefined;
    this.matchText = s;
    this.matchLine = this.line;
    this.matchColumn = this.column;
  }
  advance(s) {
    const len = s.length;
    let lines = 0;
    let lineStart = 0;
    for (let i = 0;i < len; i++) {
      const c = s.charCodeAt(i);
      if (c === 13) {
        if (s.charCodeAt(i + 1) === 10)
          i++;
      } else if (c !== 10) {
        continue;
      }
      lines++;
      lineStart = i + 1;
    }
    this.pos += len;
    if (lines) {
      this.line += lines;
      this.column = len - lineStart;
    } else {
      this.column += len;
    }
  }
  punct(s) {
    this.recordStr(s);
    this.pos += s.length;
    this.column += s.length;
  }
  saveState() {
    return new State(this.line, this.column, this.pos, this.rawMatch, this.matchText, this.matchLine, this.matchColumn);
  }
  restoreState(state) {
    this.line = state.line;
    this.column = state.column;
    this.pos = state.pos;
    this.rawMatch = state.match;
    this.matchText = state.matchText;
    this.matchLine = state.matchLine;
    this.matchColumn = state.matchColumn;
  }
  space() {
    const s = this.content;
    let p = this.pos;
    for (;; ) {
      const c = s.charCodeAt(p);
      if (c !== 32 && c !== 9)
        break;
      p++;
    }
    if (p === this.pos)
      return false;
    this.column += p - this.pos;
    this.pos = p;
    return true;
  }
  newline() {
    const c = this.content.charCodeAt(this.pos);
    if (c === 13) {
      this.pos += this.content.charCodeAt(this.pos + 1) === 10 ? 2 : 1;
    } else if (c === 10) {
      this.pos++;
    } else {
      return false;
    }
    this.line++;
    this.column = 0;
    return true;
  }
  lookingAt(re) {
    if (typeof re === "string")
      return this.content.startsWith(re, this.pos);
    re.lastIndex = this.pos;
    return re.test(this.content);
  }
  token(re) {
    re.lastIndex = this.pos;
    const match = re.exec(this.content);
    if (!match)
      return false;
    this.record(match);
    this.advance(match[0]);
    return true;
  }
  tokenStr(s) {
    if (!this.content.startsWith(s, this.pos))
      return false;
    this.recordStr(s);
    this.advance(s);
    return true;
  }
  lookBehind(re) {
    const prefix = this.content.substring(0, this.pos);
    if (typeof re === "string")
      return prefix.endsWith(re);
    const match = re.exec(prefix);
    if (!match)
      return false;
    this.record(match);
    return true;
  }
  matched() {
    return this.matchText !== undefined;
  }
  matchLineNo() {
    return this.matchLine;
  }
  matchColumnNo() {
    return this.matchColumn;
  }
  group(index = 0) {
    return index === 0 ? this.matchText : this.rawMatch?.[index];
  }
  eof() {
    return this.pos >= this.content.length;
  }
}

// src/frontend/lint.ts
var RE_PRAGMA = /^;+\s*js65-lint-disable-(next-)?line\b[\s,]*(.*)$/;

class LintPragmas {
  suppressions = new Map;
  record(file, commentLine, comment) {
    const pragma = RE_PRAGMA.exec(comment);
    if (!pragma)
      return;
    const rules = pragma[2].trim().split(/[\s,]+/).filter((r) => r);
    if (!rules.length)
      return;
    const line = commentLine + (pragma[1] ? 1 : 0);
    const key = `${file}:${line}`;
    let set = this.suppressions.get(key);
    if (!set)
      this.suppressions.set(key, set = new Set);
    for (const rule of rules)
      set.add(rule);
  }
  suppressed(rule, source) {
    for (let s = source;s; s = s.parent) {
      const set = this.suppressions.get(`${s.file}:${s.line}`);
      if (set?.has(rule))
        return true;
    }
    return false;
  }
}

class LintRule {
  report;
  constructor(report) {
    this.report = report;
  }
  instruction(_inst) {}
  label(_ident) {}
  endInstructionSequence() {}
  rtsBackref(_index) {}
  enterProc(_name) {}
  assert() {}
  exitProc(_at) {}
  closeModule() {}
}

class BareNumberOperand extends LintRule {
  static id = "bare-number-operand";
  static level = "warning";
  static description = "a lone decimal/binary literal used as an address, e.g. `lda 5`";
  instruction(inst) {
    const num = soleOperandToken(inst);
    if (!num || num.token !== "num" || num.radix !== 10 && num.radix !== 2) {
      return;
    }
    const site = inst.tokens?.[0].source;
    const operand = addressOperand(inst);
    if (!operand)
      return;
    if (!sameOrigin(num.source, site))
      return;
    const { mnemonic, ops } = inst;
    const lit = render(num);
    const hex = hexLiteral(num.num);
    const prefix = num.num > 255 ? "a:" : "z:";
    const forced = operand.map((t) => t === num ? prefix + lit : render(t)).join("");
    const immediate = "imm" in ops ? ` Write \`${mnemonic} #${lit}\` if you meant the immediate.` : "";
    this.report(`\`${mnemonic} ${render(...operand)}\` uses ${lit} as an ` + `address, not a value.${immediate} Define a named constant ` + `(\`FOO = ${lit}\`), write the address in hex (\`${hex}\`), or ` + `force the address size (\`${mnemonic} ${forced}\`) to silence ` + `this.`, num.source);
  }
}

class SuspiciousAddressExpr extends LintRule {
  static id = "suspicious-address-expr";
  static level = "warning";
  static description = "a lo/hi byte expression used as an address, e.g. `lda <label`";
  instruction(inst) {
    const { mnemonic, arg, ops } = inst;
    if (arg[0] !== "add")
      return;
    if (!("imm" in ops))
      return;
    const operand = addressOperand(inst);
    if (!operand)
      return;
    const expr = arg[1];
    if (expr?.op !== "<" && expr?.op !== ">")
      return;
    const inner = expr.args?.[0];
    if (!inner || !isAddress2(inner) || inner.meta?.zeropage)
      return;
    const first = operand[0];
    if (first.token !== "op" || first.str !== expr.op)
      return;
    const text = render(...operand);
    const byte = first.str === "<" ? "low" : "high";
    this.report(`\`${mnemonic} ${text}\` takes the ${byte} byte but is used ` + `as an address, not an immediate. Did you mean ` + `\`${mnemonic} #${text}\`? Write \`${mnemonic} z:${text}\` if ` + `the zero-page read is intentional.`, first.source);
  }
}

class EndprocNoTerminator extends LintRule {
  static id = "endproc-no-terminator";
  static level = "warning";
  static description = "`.endproc` whose last instruction falls through";
  procStack = [];
  instruction({ mnemonic, ops, tokens }) {
    const frame = this.procStack[this.procStack.length - 1];
    if (!frame)
      return;
    frame.count++;
    frame.lastMnemonic = mnemonic;
    frame.lastTokens = tokens;
    frame.terminates = transfersControl(mnemonic, ops);
    frame.asserted = false;
  }
  enterProc(name) {
    this.procStack.push({
      name,
      count: 0,
      lastMnemonic: "",
      terminates: false,
      asserted: false
    });
  }
  assert() {
    const frame = this.procStack[this.procStack.length - 1];
    if (frame)
      frame.asserted = true;
  }
  exitProc(at) {
    const frame = this.procStack.pop();
    if (!frame)
      return;
    if (!frame.count || frame.terminates || frame.asserted)
      return;
    const last = renderInstruction(frame.lastMnemonic, frame.lastTokens);
    this.report(`\`.endproc\` for \`${frame.name}\` ends with ` + `\`${last}\`, instead of a terminal instruction. ` + `Add a terminating opcode (rts/rit/jmp/jsr/branch), assert the ` + `fall-through with \`FALLTHROUGH next\` (from ` + `\`.macpack common\`), or \`; js65-lint-disable-next-line ` + `endproc-no-terminator\` if it is intentional.`, at);
  }
}

class AdjacentInstructions extends LintRule {
  prev;
  instruction({ mnemonic, arg, tokens }) {
    this.prev = tokens ? { mnemonic, mode: arg[0], tokens } : undefined;
  }
  endInstructionSequence() {
    this.prev = undefined;
  }
}

class JsrRtsTailCall extends AdjacentInstructions {
  static id = "jsr-rts-tail-call";
  static level = "info";
  static description = "`jsr` immediately followed by `rts`, which could be a `jmp`";
  tailCalls = [];
  referencedRts = new Set;
  instruction(inst) {
    const prev = this.prev;
    super.instruction(inst);
    const { arg, tokens, rts } = inst;
    if (!rts || !tokens || arg[0] !== "imp")
      return;
    if (rts.claimed)
      return;
    if (prev?.mnemonic !== "jsr" || prev.mode !== "add")
      return;
    this.tailCalls.push({ jsr: prev, rts: tokens[0], index: rts.index });
  }
  rtsBackref(index) {
    this.referencedRts.add(index);
  }
  closeModule() {
    for (const { jsr, rts, index } of this.tailCalls) {
      if (this.referencedRts.has(index))
        continue;
      const target = render(...jsr.tokens.slice(1));
      this.report(`\`jsr ${target}\` followed by \`rts\` can usually ` + `be replaced with \`jmp ${target}\`. ` + `Label the \`rts\` to silence this warning or add \`; js65-lint-disable-next-line ` + `jsr-rts-tail-call\`.`, jsr.tokens[0].source, tailCallFix(jsr.tokens[0], target, rts));
    }
    this.tailCalls.length = 0;
  }
}

class JmpFallthrough extends AdjacentInstructions {
  static id = "jmp-fallthrough";
  static level = "info";
  static description = "`jmp` to the label defined on the next line";
  label(ident) {
    const prev = this.prev;
    if (prev?.mnemonic !== "jmp" || prev.mode !== "add")
      return;
    const operand = prev.tokens.slice(1);
    if (operand.length !== 1)
      return;
    const target = operand[0];
    if (target.token !== "ident" || target.str !== ident)
      return;
    this.report(`\`jmp ${ident}\` jumps to the next instruction. Use ` + `\`FALLTHROUGH ${ident}\` (from \`.macpack common\`) to ` + `assert that this is intended, or ` + `\`; js65-lint-disable-next-line jmp-fallthrough\` to keep ` + `the jump.`, prev.tokens[0].source, fallthroughFix(prev.tokens[0], ident));
  }
}
function reporter(errorCollector, pragmas, id, level) {
  return (message, source, fix) => {
    if (pragmas?.suppressed(id, source))
      return;
    errorCollector.add(level, message, source, fix ? { code: id, fix } : { code: id });
  };
}
var SUSPICIOUS_LINE_CONTINUATION = {
  id: "suspicious-line-continuation",
  level: "warning",
  description: "a `\\` statement separator at the end of a line, which continues nothing"
};
function reportLint(rule, message, source, errorCollector, opts, pragmas) {
  if (!errorCollector || opts?.enabled === false)
    return;
  const level = opts?.rules?.[rule.id] ?? rule.level;
  if (level === "off" || pragmas?.suppressed(rule.id, source))
    return;
  errorCollector.add(level, message, source, { code: rule.id });
}
var LINT_RULE_CLASSES = [
  BareNumberOperand,
  SuspiciousAddressExpr,
  EndprocNoTerminator,
  JsrRtsTailCall,
  JmpFallthrough
];
var LINT_RULES = new Map([...LINT_RULE_CLASSES, SUSPICIOUS_LINE_CONTINUATION].map((rule) => [rule.id, rule]));

class Linter {
  rules;
  constructor(errorCollector, opts = {}, pragmas) {
    const rules = [];
    if (opts.enabled !== false) {
      for (const rule of LINT_RULE_CLASSES) {
        const level = opts.rules?.[rule.id] ?? rule.level;
        if (level === "off")
          continue;
        rules.push(new rule(reporter(errorCollector, pragmas, rule.id, level)));
      }
    }
    this.rules = rules;
  }
  instruction(mnemonic, arg, ops, tokens, rts) {
    if (!this.rules.length)
      return;
    const inst = { mnemonic, arg, ops, tokens, rts };
    for (const rule of this.rules)
      rule.instruction(inst);
  }
  label(ident) {
    for (const rule of this.rules)
      rule.label(ident);
    this.endInstructionSequence();
  }
  endInstructionSequence() {
    for (const rule of this.rules)
      rule.endInstructionSequence();
  }
  rtsBackref(index) {
    for (const rule of this.rules)
      rule.rtsBackref(index);
  }
  enterProc(name) {
    for (const rule of this.rules)
      rule.enterProc(name);
  }
  assert() {
    for (const rule of this.rules)
      rule.assert();
  }
  exitProc(at) {
    for (const rule of this.rules)
      rule.exitProc(at);
  }
  closeModule() {
    for (const rule of this.rules)
      rule.closeModule();
  }
}
var TRANSFERS_CONTROL = new Set(["jmp", "jsr", "rts", "rti", "brk"]);
function transfersControl(mnemonic, ops) {
  return TRANSFERS_CONTROL.has(mnemonic) || "rel" in ops;
}
function addressOperand({ arg, tokens }) {
  const mode = arg[0];
  if (!tokens || mode === "imm" || mode === "imp" || mode === "acc") {
    return;
  }
  const operand = tokens.slice(1);
  if (!operand.length || hasAddrSize(operand))
    return;
  return operand;
}
function soleOperandToken({ arg, tokens }) {
  const mode = arg[0];
  if (!tokens || mode === "imm" || mode === "imp" || mode === "acc") {
    return;
  }
  let found;
  for (let i = 1;i < tokens.length; i++) {
    const token = tokens[i];
    if (isSyntax(token))
      continue;
    if (found)
      return;
    found = token;
  }
  return found;
}
function tailCallFix(jsr, target, rts) {
  const from = jsr.source;
  const to = rts.source;
  if (!from || !to || from.parent || to.parent)
    return;
  if (from.file !== to.file || to.line <= from.line)
    return;
  const written = str(jsr);
  const jmp = written === written.toUpperCase() ? "JMP" : "jmp";
  return {
    title: `Replace \`${written} ${target}\` and \`rts\` with \`${jmp} ${target}\``,
    edits: [{
      file: from.file,
      startLine: from.line,
      startColumn: from.column,
      endLine: from.line,
      endColumn: from.column + written.length,
      newText: jmp
    }, {
      file: to.file,
      startLine: to.line,
      startColumn: 0,
      endLine: to.line + 1,
      endColumn: 0,
      newText: ""
    }]
  };
}
function fallthroughFix(jmp, target) {
  const from = jmp.source;
  if (!from || from.parent)
    return;
  const written = str(jmp);
  return {
    title: `Replace \`${written} ${target}\` with \`FALLTHROUGH ${target}\``,
    edits: [{
      file: from.file,
      startLine: from.line,
      startColumn: from.column,
      endLine: from.line,
      endColumn: from.column + written.length,
      newText: "FALLTHROUGH"
    }]
  };
}
function renderInstruction(mnemonic, tokens) {
  if (!tokens?.length)
    return mnemonic;
  const operand = render(...tokens.slice(1));
  return operand ? `${render(tokens[0])} ${operand}` : render(tokens[0]);
}
function isAddress2(expr) {
  return expr.op === "sym" || expr.meta?.chunk != null;
}
function sameOrigin(a, b) {
  for (;; ) {
    if (!a || !b)
      return !a && !b;
    if (a.file !== b.file || a.line !== b.line)
      return false;
    a = a.parent;
    b = b.parent;
  }
}
function hasAddrSize(operand) {
  for (let i = 0;i < operand.length; i++) {
    if (addrSize(operand, i))
      return true;
  }
  return false;
}
function isSyntax(token) {
  switch (token.token) {
    case "lp":
    case "rp":
    case "lb":
    case "rb":
      return true;
    case "op":
      return token.str === ",";
    case "ident": {
      if (token.str.length !== 1)
        return false;
      const c = token.str.charCodeAt(0) | 32;
      return c === 120 || c === 121;
    }
    default:
      return false;
  }
}
function render(...tokens) {
  return tokens.map((token) => {
    switch (token.token) {
      case "num":
        if (token.radix === 16)
          return hexLiteral(token.num);
        if (token.radix === 2)
          return `%${token.num.toString(2)}`;
        return String(token.num);
      case "ident":
        return token.str;
      case "op":
        return token.str;
      case "cs":
        return token.rawStr ?? token.str;
      case "str":
        return JSON.stringify(token.str);
      case "lp":
        return "(";
      case "rp":
        return ")";
      case "lb":
        return "[";
      case "rb":
        return "]";
      default:
        return "";
    }
  }).join("");
}
function hexLiteral(num) {
  return `$${num.toString(16).padStart(num > 255 ? 4 : 2, "0")}`;
}

// src/tokenizer.ts
var NEWLINE = /(\r\n|\n|\r)/y;
var RE_COMMENT = /;.*/y;
var RE_LINE_CONT = /\\(\r\n|\n|\r)/y;
var RE_BLOCK_COMMENT = /\/\*[^]*?\*\//y;
var RE_BLOCK_COMMENT_OPEN = /\/\*/y;
var RE_REST_OF_FILE = /[^]*/y;
var RE_AT_IDENT = /@+[a-z0-9_]*/iy;
var RE_IDENT = /[a-z_][a-z0-9_]*/iy;
var RE_CS = /\.[a-z_][a-z0-9_]*/iy;
var RE_LOCAL_LABEL = /:([+-]\d+|[-+]+|<+rts|>*rts)/y;
var RE_OPERATOR = /(::|:=|:|\++|-+|&&?|\|\|?|[#*/,=~!^]|<[<>=]?|>[>=]?)/y;
var RE_STRING_START = /["']/y;
var RE_UNICODE_ESC = /\\u([0-9a-f]{4})/iy;
var RE_HEX_ESC = /\\x([0-9a-f]{2})/iy;
var RE_CHAR_ESC = /\\(.)/y;
var RE_ANY = /./y;
var RE_SEP_AT_EOL = /[ \t]*(;[^\n\r]*)?(\r\n|\n|\r|$)/y;
function isNumberChar(c) {
  return c >= 48 && c <= 57 || c >= 97 && c <= 122 || c >= 65 && c <= 90 || c === 95;
}
function isDecDigit(c) {
  return c >= 48 && c <= 57;
}
function isHexDigit(c) {
  if (c >= 48 && c <= 57)
    return true;
  c |= 32;
  return c >= 97 && c <= 102;
}
function isBinDigit(c) {
  return c === 48 || c === 49;
}

class Tokenizer {
  file;
  opts;
  sourceContents;
  errorCollector;
  buffer;
  constructor(str, file = "input.s", opts = {}, sourceContents, errorCollector) {
    this.file = file;
    this.opts = opts;
    this.sourceContents = sourceContents;
    this.errorCollector = errorCollector;
    this.buffer = new Buffer(str);
    this.sourceContents?.data?.set(file, str);
  }
  next() {
    return this.nextSync();
  }
  nextSync() {
    for (;; ) {
      try {
        return this.nextLine();
      } catch (err) {
        if (!this.recoversFromTokenErrors || !this.errorCollector || !(err instanceof SourceError)) {
          throw err;
        }
        this.errorCollector.addFromException(err);
        if (!this.skipLine())
          return;
      }
    }
  }
  get recoversFromTokenErrors() {
    return true;
  }
  skipLine() {
    while (!this.buffer.eof()) {
      const pos = this.buffer.pos;
      try {
        if (eq(this.token(), EOL))
          return !this.buffer.eof();
      } catch (err) {
        if (!(err instanceof SourceError))
          throw err;
      }
      if (this.buffer.pos === pos)
        this.buffer.token(RE_ANY);
    }
    return false;
  }
  nextLine() {
    let tok = this.token();
    while (eq(tok, EOL)) {
      tok = this.token();
    }
    const stack = [[]];
    let depth = 0;
    while (!eq(tok, EOL) && !eq(tok, EOF)) {
      if (eq(tok, LC)) {
        stack[depth++].push(tok);
        stack.push([]);
      } else if (eq(tok, RC)) {
        if (!depth) {
          this.errorCollector?.add("error", `Missing open curly`, tok.source);
        } else {
          const inner = stack.pop();
          const source = stack[--depth].pop().source;
          stack[depth].push(grpToken(inner, source));
        }
      } else {
        stack[depth].push(tok);
      }
      tok = this.token();
    }
    while (depth > 0) {
      const open = stack[depth - 1].pop();
      this.errorCollector?.add("error", `Missing close curly`, open.source);
      const inner = stack.pop();
      stack[--depth].push(grpToken(inner, open.source));
    }
    return stack[0].length ? stack[0] : undefined;
  }
  skipIgnored() {
    const buf = this.buffer;
    for (;; ) {
      switch (buf.content.charCodeAt(buf.pos)) {
        case 32:
        case 9:
          buf.space();
          continue;
        case 59:
          buf.token(RE_COMMENT);
          if (this.opts.lintPragmas) {
            this.opts.lintPragmas.record(this.file, buf.matchLineNo(), buf.group());
          }
          continue;
        case 92:
          if (this.opts.lineContinuations && buf.token(RE_LINE_CONT))
            continue;
          return;
        case 47:
          if (this.opts.cComments && this.blockComment())
            continue;
          return;
        default:
          return;
      }
    }
  }
  blockComment() {
    if (!this.buffer.lookingAt(RE_BLOCK_COMMENT_OPEN))
      return false;
    const source = sourceInfo(this.file, this.buffer.line, this.buffer.column);
    if (this.buffer.token(RE_BLOCK_COMMENT))
      return true;
    this.buffer.token(RE_REST_OF_FILE);
    this.unterminated(`Unterminated comment, expected */`, source);
    return true;
  }
  matchNumber() {
    const s = this.buffer.content;
    const start = this.buffer.pos;
    const sep = this.opts.numberSeparators;
    let p = start;
    let digits = 0;
    switch (s.charCodeAt(p)) {
      case 36: {
        for (p++;; p++) {
          const c = s.charCodeAt(p);
          if (isHexDigit(c))
            digits++;
          else if (!(sep && c === 95))
            break;
        }
        if (p === start + 1 && !isNumberChar(s.charCodeAt(p)))
          return;
        const text = this.numDigits(start, start + 1, p, digits, "hex");
        return numToken(+("0x" + text), undefined, Math.ceil(digits / 2), 16);
      }
      case 37: {
        for (p++;; p++) {
          const c = s.charCodeAt(p);
          if (isBinDigit(c))
            digits++;
          else if (!(sep && c === 95))
            break;
        }
        if (p === start + 1 && !isNumberChar(s.charCodeAt(p)))
          return;
        const text = this.numDigits(start, start + 1, p, digits, "binary");
        return numToken(+("0b" + text), undefined, Math.ceil(digits / 8), 2);
      }
      default: {
        for (;; p++) {
          const c = s.charCodeAt(p);
          if (isDecDigit(c))
            digits++;
          else if (!(sep && c === 95))
            break;
        }
        const text = this.numDigits(start, start, p, digits, "decimal");
        return numToken(+text, undefined, undefined, 10);
      }
    }
  }
  numDigits(start, digitsAt, end, count, name) {
    const buf = this.buffer;
    const s = buf.content;
    if (count && !isNumberChar(s.charCodeAt(end))) {
      const str = s.substring(start, end);
      buf.punct(str);
      const text = digitsAt === start ? str : s.substring(digitsAt, end);
      return count === end - digitsAt ? text : text.replaceAll("_", "");
    }
    let p = end;
    while (isNumberChar(s.charCodeAt(p)))
      p++;
    const str = s.substring(start, p);
    buf.punct(str);
    throw new Error(`Bad ${name} number: ${this.opts.numberSeparators ? str.replaceAll("_", "") : str}`);
  }
  matchOperator() {
    return this.buffer.token(RE_OPERATOR) ? this.strTok("op") : undefined;
  }
  matchAddrSize(c) {
    const buf = this.buffer;
    if (buf.content.charCodeAt(buf.pos + 1) !== 58)
      return;
    if (buf.content.charCodeAt(buf.pos + 2) === 58)
      return;
    const str = c === 97 || c === 65 ? "a:" : c === 122 || c === 90 ? "z:" : "f:";
    buf.punct(str);
    return strToken("op", str);
  }
  isRegister(c) {
    c |= 32;
    return c === 97 || c === 120 || c === 121;
  }
  tokenOther(_c) {
    const ch = this.buffer.content[this.buffer.pos];
    throw new Error(`Syntax error${ch ? `: unexpected '${ch}'` : ""}`);
  }
  token() {
    this.skipIgnored();
    if (this.buffer.eof())
      return EOF;
    const source = sourceInfo(this.file, this.buffer.line, this.buffer.column);
    try {
      const tok = this.tokenInternal();
      if (this.opts.generateDebugInfo) {
        source.endLine = this.buffer.line;
        source.endColumn = this.buffer.column;
      }
      tok.source = source;
      return tok;
    } catch (err) {
      const last = this.buffer.matched() && this.buffer.matchLineNo() === source.line && this.buffer.matchColumnNo() === source.column ? this.buffer.group() : undefined;
      const located = new SourceError(`${err.message}${last ? ` near '${last}'` : ""}`, source);
      located.stack = err.stack;
      throw located;
    }
  }
  tokenInternal() {
    const buf = this.buffer;
    const c = buf.content.charCodeAt(buf.pos);
    if (c >= 97 && c <= 122 || c >= 65 && c <= 90 || c === 95) {
      return this.tokenIdent(c);
    }
    if (c >= 48 && c <= 57 || c === 36 || c === 37) {
      return this.matchNumber() ?? this.tokenOther(c);
    }
    switch (c) {
      case 10:
      case 13:
        buf.newline();
        return nullToken("eol");
      case 64:
        buf.token(RE_AT_IDENT);
        return this.strTok("ident");
      case 46:
        if (buf.token(RE_CS))
          return this.csTok();
        return this.tokenOther(c);
      case 34:
      case 39:
        buf.token(RE_STRING_START);
        return this.tokenizeStr();
      case 91:
        buf.punct("[");
        return nullToken("lb");
      case 123:
        buf.punct("{");
        return nullToken("lc");
      case 40:
        buf.punct("(");
        return nullToken("lp");
      case 93:
        buf.punct("]");
        return nullToken("rb");
      case 125:
        buf.punct("}");
        return nullToken("rc");
      case 41:
        buf.punct(")");
        return nullToken("rp");
      case 92:
        if (this.opts.backslashSeparator)
          return this.separator("\\");
        throw new Error(this.opts.lineContinuations ? `Expected a line break after '\\'` : `Unexpected '\\'; line_continuations is off`);
      case 96:
        if (this.opts.backtickSeparator)
          return this.separator("`");
        return this.tokenOther(c);
      case 58:
        if (buf.token(RE_LOCAL_LABEL))
          return this.strTok("ident");
      case 43:
      case 45:
      case 38:
      case 124:
      case 35:
      case 42:
      case 47:
      case 44:
      case 61:
      case 126:
      case 33:
      case 94:
      case 60:
      case 62:
        return this.matchOperator() ?? this.tokenOther(c);
    }
    return this.tokenOther(c);
  }
  separator(ch) {
    const buf = this.buffer;
    const source = sourceInfo(this.file, buf.line, buf.column);
    buf.punct(ch);
    if (ch === "\\")
      this.separatorAtEol(source);
    return nullToken("eol");
  }
  separatorAtEol(source) {
    RE_SEP_AT_EOL.lastIndex = this.buffer.pos;
    const rest = RE_SEP_AT_EOL.exec(this.buffer.content);
    if (!rest)
      return;
    if (rest[1])
      this.opts.lintPragmas?.record(this.file, source.line, rest[1]);
    reportLint(SUSPICIOUS_LINE_CONTINUATION, this.opts.lineContinuations ? "`\\` must be followed immediately by a line break to " + "continue a line. The whitespace after it makes this a " + "statement separator, so the next line is a separate " + "statement. Remove the whitespace to continue the line." : "this `\\` is a statement separator at the end of a line, " + "so it separates nothing and can be removed.", source, this.errorCollector, this.opts.lint, this.opts.lintPragmas);
  }
  tokenIdent(c) {
    if (c === 97 || c === 122 || c === 102 || c === 65 || c === 90 || c === 70) {
      const addrSize = this.matchAddrSize(c);
      if (addrSize)
        return addrSize;
    }
    this.buffer.token(RE_IDENT);
    const str = this.buffer.group();
    return strToken("ident", str.length === 1 && this.isRegister(c) ? str.toLowerCase() : str);
  }
  tokenizeStr() {
    const b = this.buffer;
    const end = b.group();
    const startLine = b.matchLineNo();
    const startColumn = b.matchColumnNo();
    let str = "";
    while (!b.lookingAt(end)) {
      if (b.eof() || b.lookingAt(NEWLINE)) {
        this.unterminated(`Unterminated string, expected ${end}`, sourceInfo(this.file, startLine, startColumn));
        return this.makeStrToken(end, str);
      }
      if (b.token(RE_UNICODE_ESC)) {
        str += String.fromCodePoint(parseInt(b.group(1), 16));
      } else if (b.token(RE_HEX_ESC)) {
        str += String.fromCharCode(parseInt(b.group(1), 16));
      } else if (b.token(RE_CHAR_ESC)) {
        str += b.group(1);
      } else {
        b.token(RE_ANY);
        str += b.group(0);
      }
    }
    b.tokenStr(end);
    return this.makeStrToken(end, str);
  }
  makeStrToken(quote, str) {
    return strToken("str", str, undefined, undefined, quote === `'` ? true : undefined);
  }
  unterminated(message, source) {
    if (!this.errorCollector)
      throw new SourceError(message, source);
    this.errorCollector.add("error", message, source);
  }
  strTok(token) {
    return strToken(token, this.buffer.group());
  }
  csTok() {
    const grp = this.buffer.group();
    const lower = grp.toLowerCase();
    if (this.opts.leadingDotInIdentifiers && !CS_KEYWORDS.has(lower)) {
      return strToken("ident", lower);
    }
    return strToken("cs", CS_TOKEN_ALIAS_MAP.get(lower) ?? lower, undefined, grp);
  }
}

// src/options.ts
class JsActionTable {
  entries = [];
  add(run) {
    return this.entries.push(run) - 1;
  }
  run(index, ctx) {
    return this.entries[index]?.(ctx);
  }
}

class UnknownFeatureError extends Error {
}

class UnsupportedFeatureError extends Error {
}
function applyFeature(name, asm, tok, on = true) {
  const key = name.toLowerCase();
  switch (key) {
    case "bracket_as_indirect":
      asm.allowBrackets = on;
      return;
    case "labels_without_colons":
      asm.labelsWithoutColons = on;
      return;
    case "pc_assignment":
      asm.pcAssignment = on;
      return;
    case "force_range":
      asm.forceRange = on;
      return;
    case "ubiquitous_idents":
      asm.ubiquitousIdents = on;
      return;
    case "js65_multiops_per_line":
      asm.multiOpsPerLine = on;
      return;
    case "js65_backslash_separator":
      tok.backslashSeparator = on;
      return;
    case "js65_backtick_separator":
      tok.backtickSeparator = on;
      return;
    case "c_comments":
      tok.cComments = on;
      return;
    case "line_continuations":
      tok.lineContinuations = on;
      return;
    case "underline_in_numbers":
      tok.numberSeparators = on;
      return;
    case "leading_dot_in_identifiers":
      tok.leadingDotInIdentifiers = on;
      return;
    case "at_in_identifiers":
    case "addrsize":
    case "string_escapes":
    case "loose_string_term":
    case "loose_char_term":
    case "missing_char_term":
    case "org_per_seg": {
      const reason = UNCONDITIONAL.get(key);
      throw new RecoverableError(`Cannot change feature ${key} (${reason})`);
    }
    case "long_jsr_jmp_rts":
      return;
    default: {
      const reason = UNSUPPORTED.get(key);
      if (reason)
        throw new UnsupportedFeatureError(`${key} (${reason})`);
      throw new UnknownFeatureError(name);
    }
  }
}
function applyFeatures(names, asm, tok) {
  const messages = [];
  for (const name of names) {
    try {
      applyFeature(name, asm, tok);
    } catch (err) {
      if (err instanceof RecoverableError) {
        messages.push({ level: "warning", message: err.message });
      } else if (err instanceof UnknownFeatureError) {
        messages.push({ level: "error", message: `Unknown feature: ${err.message}` });
      } else if (err instanceof UnsupportedFeatureError) {
        messages.push({ level: "error", message: `Unsupported feature: ${err.message}` });
      } else {
        throw err;
      }
    }
  }
  return messages;
}
var UNCONDITIONAL = new Map([
  ["at_in_identifiers", "`@` is always js65 cheap-local prefix"],
  ["addrsize", "`.addrsize()` is always available"],
  ["string_escapes", "`\\u`, `\\x` and `\\<char>` always honored"],
  ["loose_string_term", "both quote styles always accepted"],
  ["loose_char_term", "single-quoted strings are character literals"],
  ["missing_char_term", "an unterminated string recovers, not fatal"],
  ["org_per_seg", "`.org` is already per-chunk; there is no global PC"]
]);
var UNSUPPORTED = new Map([
  ["dollar_in_identifiers", "`$` currently always starts a hex literal"],
  [
    "dollar_is_pc",
    "`$` currently always starts a hex literal; js65 spells the PC `*`"
  ]
]);

// src/frontend/scope.ts
var SIZE_NAME = ".size";
var SIZE_SUFFIX = `::${SIZE_NAME}`;
var RE_SCOPE_SPLIT = /::/g;
function isSizeOfSymbol(name) {
  return name === SIZE_NAME || name.endsWith(SIZE_SUFFIX);
}
function firstRef(sym) {
  return sym?.refs?.[0];
}

class BaseScope {
  symbols = new Map;
  collectRefs;
  pickScope(name, _at, _missing) {
    return [name, this];
  }
  resolve(name, opts = {}) {
    const { allowForwardRef = false, ref } = opts;
    const missingScope = opts.missingScope ?? (allowForwardRef ? "create" : "fail");
    const picked = this.pickScope(name, ref, missingScope);
    if (!picked)
      return;
    const [tail, scope] = picked;
    const sym = scope.symbols.get(tail);
    if (sym) {
      if (tail !== name)
        sym.scoped = true;
      if (ref?.source && (scope.collectRefs || !sym.refs)) {
        (sym.refs ??= []).push(ref.source);
      }
      return sym;
    }
    if (!allowForwardRef)
      return;
    const symbol = ref?.source ? { refs: [ref.source] } : {};
    scope.symbols.set(tail, symbol);
    if (tail !== name)
      symbol.scoped = true;
    return symbol;
  }
  declare(name, symbol, at) {
    const [tail, scope] = this.pickScope(name, at ?? { source: firstRef(symbol) });
    scope.symbols.set(tail, symbol);
    if (tail !== name)
      symbol.scoped = true;
    return symbol;
  }
}

class Scope extends BaseScope {
  parent;
  kind;
  global;
  children = new Map;
  anonymousChildren = [];
  startPc;
  label;
  forwardDeclared;
  name;
  dbgType;
  anonId;
  debugRuns;
  qualifiedPrefix() {
    const parts = [];
    for (let scope = this;scope?.parent; scope = scope.parent) {
      if (scope.name)
        parts.unshift(scope.name);
    }
    return parts.length ? `${parts.join("::")}::` : "";
  }
  constructor(parent, kind) {
    super();
    this.parent = parent;
    this.kind = kind;
    this.global = parent ? parent.global : this;
    this.collectRefs = parent?.collectRefs;
  }
  walkScopes(parts) {
    let scope = this;
    for (let i = 0;i < parts.length; i++) {
      if (!i && !parts[i]) {
        scope = scope.global;
        continue;
      }
      let child = scope.children.get(parts[i]);
      while (!i && scope.parent && !child) {
        child = (scope = scope.parent).children.get(parts[i]);
      }
      if (!child)
        return { missing: i };
      scope = child;
    }
    return { scope };
  }
  findScope(name) {
    const found = this.walkScopes(name.split(RE_SCOPE_SPLIT));
    return "scope" in found ? found.scope : undefined;
  }
  pickScope(name, at, missing = "fail") {
    const split = name.split(RE_SCOPE_SPLIT);
    const tail = split.pop();
    const found = this.walkScopes(split);
    if ("missing" in found) {
      if (missing === "undefined")
        return;
      if (missing === "create")
        return [tail, this.createScopes(split)];
      fail(`Could not resolve scope ${split.slice(0, found.missing + 1).join("::")}`, at);
    }
    return [tail, found.scope];
  }
  createScopes(parts) {
    let scope = this;
    for (let i = 0;i < parts.length; i++) {
      if (!i && !parts[i]) {
        scope = scope.global;
        continue;
      }
      let child = scope.children.get(parts[i]);
      while (!i && scope.parent && !child) {
        child = (scope = scope.parent).children.get(parts[i]);
      }
      if (!child) {
        child = new Scope(scope);
        child.forwardDeclared = true;
        child.name = parts[i];
        scope.children.set(parts[i], child);
      }
      scope = child;
    }
    return scope;
  }
}

class CheapScope extends BaseScope {
  clear(collector) {
    this.validate(collector);
    this.symbols.clear();
  }
  validate(collector) {
    for (const [name, sym] of this.symbols) {
      if (!sym.expr) {
        const msg = `Cheap local label never defined: ${name}`;
        if (!collector)
          fail(msg, { source: firstRef(sym) });
        collector.add("error", msg, firstRef(sym));
      }
    }
  }
}
function parseSymbol(name) {
  if (name === "*")
    return { type: "pc" };
  if (/^:\++$/.test(name))
    return { type: "anon", num: name.length - 1 };
  if (/^:\+\d+$/.test(name))
    return { type: "anon", num: parseInt(name.substring(2)) };
  if (/^:-+$/.test(name))
    return { type: "anon", num: 1 - name.length };
  if (/^:-\d+$/.test(name))
    return { type: "anon", num: -parseInt(name.substring(2)) };
  if (/^:>*rts$/.test(name))
    return { type: "rts", num: Math.max(name.length - 4, 1) };
  if (/^:<+rts$/.test(name))
    return { type: "rts", num: 4 - name.length };
  if (/^\++$/.test(name))
    return { type: "rel", num: name.length };
  if (/^-+$/.test(name))
    return { type: "rel", num: -name.length };
  return { type: "none" };
}

// src/frontend/charmap.ts
class CharMap {
  fail;
  mapping = new MaxKeySizeCacheMap;
  stack = [];
  constructor(fail) {
    this.fail = fail;
  }
  set(code, target) {
    if (code < 0 || code > 255)
      this.fail(`.charmap index out of range: ${code}`);
    this.mapping.set(String.fromCodePoint(code), [target & 255]);
  }
  strMap(key, bytes) {
    if (!key)
      this.fail(`.strmap key must not be empty`);
    if (!bytes.length)
      this.fail(`.strmap value must not be empty`);
    this.mapping.set(key, bytes.map((b) => b & 255));
  }
  push() {
    this.stack.push(new MaxKeySizeCacheMap(this.mapping));
  }
  pop() {
    this.mapping = this.stack.pop() ?? this.mapping;
  }
  encodeChar = (char) => {
    const bytes = this.mapping.get(char);
    if (!bytes)
      return;
    if (bytes.length !== 1) {
      this.fail(`Character literal '${char}' maps to ${bytes.length} bytes`);
    }
    return bytes[0];
  };
}
function writeString(data, str, charmap) {
  const chars = Array.from(str);
  const maxKeyLen = charmap.getLargestKeySize();
  for (let i = 0;i < chars.length; ) {
    let bytes;
    let len = Math.min(maxKeyLen, chars.length - i);
    for (;len >= 1; len--) {
      bytes = charmap.get(chars.slice(i, i + len).join(""));
      if (bytes)
        break;
    }
    if (bytes) {
      data.push(...bytes);
      i += len;
    } else {
      data.push(chars[i].codePointAt(0) & 255);
      i++;
    }
  }
}

// src/frontend/locallabels.ts
class LocalLabels {
  allocSymbol;
  fail;
  rtsBackref;
  anonymousForward = [];
  anonymousReverse = [];
  relativeForward = [];
  relativeReverse = [];
  rtsRefsForward = [];
  rtsRefsReverse = [];
  constructor(allocSymbol, fail, rtsBackref) {
    this.allocSymbol = allocSymbol;
    this.fail = fail;
    this.rtsBackref = rtsBackref;
  }
  resolve(name, parsed) {
    if (parsed.type === "anon" && parsed.num > 0) {
      const i = parsed.num - 1;
      return this.forwardRef(this.anonymousForward[i] ??= this.allocSymbol());
    } else if (parsed.type === "rts" && parsed.num > 0) {
      const i = parsed.num - 1;
      return this.forwardRef(this.rtsRefsForward[i] ??= this.allocSymbol());
    } else if (parsed.type === "rel" && parsed.num > 0) {
      return this.forwardRef(this.relativeForward[name.length - 1] ??= this.allocSymbol());
    } else if (parsed.type === "anon" && parsed.num < 0) {
      const i = this.anonymousReverse.length + parsed.num;
      if (i < 0)
        this.fail(`Bad anonymous backref: ${name}`);
      return this.anonymousReverse[i];
    } else if (parsed.type === "rts" && parsed.num < 0) {
      const i = this.rtsRefsReverse.length + parsed.num;
      if (i < 0)
        this.fail(`Bad rts backref: ${name}`);
      this.rtsBackref(i);
      return this.rtsRefsReverse[i];
    } else if (parsed.type === "rel" && parsed.num < 0) {
      const expr = this.relativeReverse[name.length - 1];
      if (expr == null)
        this.fail(`Bad relative backref: ${name}`);
      return expr;
    }
    return;
  }
  forwardRef(sym) {
    return { op: "sym", num: sym.id };
  }
  label(ident, expr) {
    if (ident === ":") {
      this.anonymousReverse.push(expr);
      const sym = this.anonymousForward.shift();
      if (sym != null)
        sym.expr = expr;
      return "+";
    } else if (/^\++$/.test(ident)) {
      const sym = this.relativeForward[ident.length - 1];
      this.relativeForward[ident.length - 1] = undefined;
      if (sym != null)
        sym.expr = expr;
      return "+";
    } else if (/^-+$/.test(ident)) {
      this.relativeReverse[ident.length - 1] = expr;
      return "-";
    }
    return;
  }
  rts(expr) {
    const index = this.rtsRefsReverse.push(expr) - 1;
    const sym = this.rtsRefsForward.shift();
    if (sym != null)
      sym.expr = expr;
    return { index, claimed: sym != null };
  }
}

// node_modules/.bun/sha1-uint8array@0.10.7/node_modules/sha1-uint8array/dist/sha1-uint8array.mjs
var K = [
  1518500249 | 0,
  1859775393 | 0,
  2400959708 | 0,
  3395469782 | 0
];
var algorithms = {
  sha1: 1
};
function createHash(algorithm) {
  if (algorithm && !algorithms[algorithm] && !algorithms[algorithm.toLowerCase()]) {
    throw new Error("Digest method not supported");
  }
  return new Hash;
}

class Hash {
  constructor() {
    this.A = 1732584193 | 0;
    this.B = 4023233417 | 0;
    this.C = 2562383102 | 0;
    this.D = 271733878 | 0;
    this.E = 3285377520 | 0;
    this._size = 0;
    this._sp = 0;
    if (!sharedBuffer || sharedOffset >= 8000) {
      sharedBuffer = new ArrayBuffer(8000);
      sharedOffset = 0;
    }
    this._byte = new Uint8Array(sharedBuffer, sharedOffset, 80);
    this._word = new Int32Array(sharedBuffer, sharedOffset, 20);
    sharedOffset += 80;
  }
  update(data) {
    if (typeof data === "string") {
      return this._utf8(data);
    }
    if (data == null) {
      throw new TypeError("Invalid type: " + typeof data);
    }
    const byteOffset = data.byteOffset;
    const length = data.byteLength;
    let blocks = length / 64 | 0;
    let offset = 0;
    if (blocks && !(byteOffset & 3) && !(this._size % 64)) {
      const block = new Int32Array(data.buffer, byteOffset, blocks * 16);
      while (blocks--) {
        this._int32(block, offset >> 2);
        offset += 64;
      }
      this._size += offset;
    }
    const BYTES_PER_ELEMENT = data.BYTES_PER_ELEMENT;
    if (BYTES_PER_ELEMENT !== 1 && data.buffer) {
      const rest = new Uint8Array(data.buffer, byteOffset + offset, length - offset);
      return this._uint8(rest);
    }
    if (offset === length)
      return this;
    return this._uint8(data, offset);
  }
  _uint8(data, offset) {
    const { _byte, _word } = this;
    const length = data.length;
    offset = offset | 0;
    while (offset < length) {
      const start = this._size % 64;
      let index = start;
      while (offset < length && index < 64) {
        _byte[index++] = data[offset++];
      }
      if (index >= 64) {
        this._int32(_word);
      }
      this._size += index - start;
    }
    return this;
  }
  _utf8(text) {
    const { _byte, _word } = this;
    const length = text.length;
    let surrogate = this._sp;
    for (let offset = 0;offset < length; ) {
      const start = this._size % 64;
      let index = start;
      while (offset < length && index < 64) {
        let code = text.charCodeAt(offset++) | 0;
        if (code < 128) {
          _byte[index++] = code;
        } else if (code < 2048) {
          _byte[index++] = 192 | code >>> 6;
          _byte[index++] = 128 | code & 63;
        } else if (code < 55296 || code > 57343) {
          _byte[index++] = 224 | code >>> 12;
          _byte[index++] = 128 | code >>> 6 & 63;
          _byte[index++] = 128 | code & 63;
        } else if (surrogate) {
          code = ((surrogate & 1023) << 10) + (code & 1023) + 65536;
          _byte[index++] = 240 | code >>> 18;
          _byte[index++] = 128 | code >>> 12 & 63;
          _byte[index++] = 128 | code >>> 6 & 63;
          _byte[index++] = 128 | code & 63;
          surrogate = 0;
        } else {
          surrogate = code;
        }
      }
      if (index >= 64) {
        this._int32(_word);
        _word[0] = _word[16];
      }
      this._size += index - start;
    }
    this._sp = surrogate;
    return this;
  }
  _int32(data, offset) {
    let { A, B, C, D, E } = this;
    let i = 0;
    offset = offset | 0;
    while (i < 16) {
      W[i++] = swap32(data[offset++]);
    }
    for (i = 16;i < 80; i++) {
      W[i] = rotate1(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16]);
    }
    for (i = 0;i < 80; i++) {
      const S = i / 20 | 0;
      const T = rotate5(A) + ft(S, B, C, D) + E + W[i] + K[S] | 0;
      E = D;
      D = C;
      C = rotate30(B);
      B = A;
      A = T;
    }
    this.A = A + this.A | 0;
    this.B = B + this.B | 0;
    this.C = C + this.C | 0;
    this.D = D + this.D | 0;
    this.E = E + this.E | 0;
  }
  digest(encoding) {
    const { _byte, _word } = this;
    let i = this._size % 64 | 0;
    _byte[i++] = 128;
    while (i & 3) {
      _byte[i++] = 0;
    }
    i >>= 2;
    if (i > 14) {
      while (i < 16) {
        _word[i++] = 0;
      }
      i = 0;
      this._int32(_word);
    }
    while (i < 16) {
      _word[i++] = 0;
    }
    const bits64 = this._size * 8;
    const low32 = (bits64 & 4294967295) >>> 0;
    const high32 = (bits64 - low32) / 4294967296;
    if (high32)
      _word[14] = swap32(high32);
    if (low32)
      _word[15] = swap32(low32);
    this._int32(_word);
    return encoding === "hex" ? this._hex() : this._bin();
  }
  _hex() {
    const { A, B, C, D, E } = this;
    return hex32(A) + hex32(B) + hex32(C) + hex32(D) + hex32(E);
  }
  _bin() {
    const { A, B, C, D, E, _byte, _word } = this;
    _word[0] = swap32(A);
    _word[1] = swap32(B);
    _word[2] = swap32(C);
    _word[3] = swap32(D);
    _word[4] = swap32(E);
    return _byte.slice(0, 20);
  }
}
var W = new Int32Array(80);
var sharedBuffer;
var sharedOffset = 0;
var hex32 = (num) => (num + 4294967296).toString(16).substr(-8);
var swapLE = (c) => c << 24 & 4278190080 | c << 8 & 16711680 | c >> 8 & 65280 | c >> 24 & 255;
var swapBE = (c) => c;
var swap32 = isBE() ? swapBE : swapLE;
var rotate1 = (num) => num << 1 | num >>> 31;
var rotate5 = (num) => num << 5 | num >>> 27;
var rotate30 = (num) => num << 30 | num >>> 2;
function ft(s, b, c, d) {
  if (s === 0)
    return b & c | ~b & d;
  if (s === 2)
    return b & c | b & d | c & d;
  return b ^ c ^ d;
}
function isBE() {
  const buf = new Uint8Array(new Uint16Array([65279]).buffer);
  return buf[0] === 254;
}

// src/frontend/segmentparser.ts
var ANON_SEGMENT_ATTR_REASONS = new Map([
  ["off", `output offset is determined by the position in the file`],
  ["mem", `PC address is determined by the segment value`],
  ["out", `anon ROM segments always goes to the main output file`],
  ["load", ""],
  ["run", ""],
  ["alignload", ""],
  ["loadmem", ""],
  ["optional", ""],
  ["dedupe", ""],
  ["default", `cannot write to a default segment`],
  ["align", `a segment starts where the previous one ended. Use .align instead`],
  ["define", ""]
]);

class SegmentParser {
  host;
  moduleName;
  _segmentPrefix = "";
  _segmentOffset = 0;
  constructor(host, moduleName) {
    this.host = host;
    this.moduleName = moduleName;
  }
  setPrefix(prefix) {
    this._segmentPrefix = prefix;
  }
  generateAnonSegmentName(memory, size) {
    const source = this.host.source();
    const file = source?.file ?? this.moduleName ?? "";
    const line = source?.line;
    const input = [
      file,
      String(line ?? ""),
      String(this._segmentOffset++),
      String(memory),
      String(size)
    ].join("\x00");
    const hash = createHash().update(input).digest("hex").slice(0, 12);
    return anonSegmentName(file, line, hash);
  }
  parseFlag(tokens, key) {
    if (!tokens.length)
      return true;
    const val = this.host.parseConst(tokens, 0);
    if (val !== 0 && val !== 1) {
      this.host.fail(`Segment attr ${key} must be 0 or 1: ${val}`, tokens[0]);
    }
    return val !== 0;
  }
  parseAlign(tokens, key) {
    if (!tokens.length)
      this.host.fail(`Segment attr ${key} needs a value`);
    const val = this.host.parseConst(tokens, 0);
    if (val < 1 || (val & val - 1) !== 0) {
      this.host.fail(`Segment attr ${key} must be a power of two: ${val}`, tokens[0]);
    }
    return val;
  }
  parseSegmentList(tokens, start, allowEmptySegmentList) {
    if (tokens.length < start + 1) {
      if (allowEmptySegmentList) {
        return [];
      }
      this.host.fail(`Expected a segment list`, tokens[start - 1]);
    }
    if (tokens.find((t) => t.token == "op" && t.str == "&")) {
      return this.parseShorthandMirroredSegment(tokens);
    }
    return parseArgList(tokens, 1).map((ts, _i, all) => {
      if (ts[0]?.token === "num")
        return this.parseAnonSegment(ts, all.length);
      const str = this._segmentPrefix + expectString(ts[0]);
      if (str.startsWith(RESERVED_SEGMENT_PREFIX)) {
        this.host.fail(`Segment name may not start with '${RESERVED_SEGMENT_PREFIX}', which is reserved: ${str}`, ts[0]);
      }
      if (ts.length === 1)
        return str;
      if (!eq(ts[1], COLON)) {
        this.host.fail(`Expected comma or colon: ${name(ts[1])}`, ts[1]);
      }
      let nonCompositeAttrSeen = false;
      const seg = { name: str };
      const attrs = parseAttrList(ts, 1);
      for (const [key, val] of attrs) {
        if (key !== "mirror" && key !== "pool") {
          nonCompositeAttrSeen = true;
        }
        switch (key) {
          case "bank":
            seg.bank = this.host.parseConst(val, 0);
            break;
          case "size":
            seg.size = this.host.parseConst(val, 0);
            break;
          case "off":
            seg.offset = this.host.parseConst(val, 0);
            break;
          case "mem":
            seg.memory = this.host.parseConst(val, 0);
            break;
          case "fill":
            seg.fill = val.length ? this.host.parseConst(val, 0) : 0;
            break;
          case "out":
            seg.out = this.host.parseOptionalStr(val, 0) ?? "%O";
            break;
          case "align":
            seg.align = this.parseAlign(val, key);
            break;
          case "alignload":
            seg.alignLoad = this.parseAlign(val, key);
            break;
          case "loadmem":
            seg.loadMem = this.host.parseConst(val, 0);
            break;
          case "load":
            seg.load = this.host.parseStr(val, 0);
            break;
          case "run":
            seg.run = this.host.parseStr(val, 0);
            break;
          case "zp":
          case "zeropage":
            seg.addressing = 1;
            seg.bss = true;
            break;
          case "bss":
            seg.bss = this.parseFlag(val, key);
            break;
          case "define":
            seg.define = this.parseFlag(val, key);
            break;
          case "optional":
            seg.optional = this.parseFlag(val, key);
            break;
          case "dedupe":
            seg.dedupe = this.parseFlag(val, key);
            break;
          case "default":
            seg.default = this.parseFlag(val, key);
            break;
          case "ro":
          case "rw":
            break;
          case "mirror":
            seg.mirror = this.parseSegmentNameList(val, key, ts[1]);
            break;
          case "pool":
            seg.pool = this.parseSegmentNameList(val, key, ts[1]);
            break;
          default:
            this.host.fail(`Unknown segment attr: ${key}`);
        }
      }
      if (seg.mirror && seg.pool) {
        this.host.fail(`A segment may not have both \`:mirror\` and \`:pool\``, ts[1]);
      }
      if (nonCompositeAttrSeen && (seg.mirror || seg.pool)) {
        this.host.fail(`Cannot use other segment attributes when \`:${seg.mirror ? "mirror" : "pool"}\` is used`, ts[1]);
      }
      if (seg.offset === undefined && seg.size !== undefined && seg.out !== undefined) {
        seg.offset = this._segmentOffset;
        this._segmentOffset += seg.size;
      }
      if (seg.fill !== undefined && seg.size !== undefined) {
        seg.free = [[seg.memory ?? 0, (seg.memory ?? 0) + seg.size]];
      }
      return seg;
    });
  }
  parseSegmentNameList(val, key, at) {
    const grp = val.length === 1 && val[0].token === "grp" ? val[0] : undefined;
    if (!grp) {
      this.host.fail(`Segment attr ${key} expects a braced list: :${key} {"A", "B"}`, at);
    }
    const names = [];
    for (const tok of grp.inner) {
      if (eq(tok, COMMA))
        continue;
      if (tok.token !== "str") {
        this.host.fail(`Segment attr ${key} expects a list of segment name strings`, tok);
      }
      names.push(tok.str);
    }
    return this.checkCompositeMembers(names, key, at);
  }
  checkCompositeMembers(names, key, at) {
    if (names.length < 2) {
      this.host.fail(`Segment attr ${key} needs at least two segments: ${names.length ? names.join(", ") : "(empty)"}`, at);
    }
    const prefixed = names.map((n) => this._segmentPrefix + n);
    if (new Set(prefixed).size !== prefixed.length) {
      this.host.fail(`Segment attr ${key} contains a duplicate segment: ${prefixed.join(", ")}`, at);
    }
    return prefixed;
  }
  parseAnonSegment(ts, argCount) {
    if (argCount > 1) {
      this.host.fail(`An anonymous .segment may not appear in a comma-separated list`, ts[0]);
    }
    const colon = find(ts, COLON, 0);
    if (colon < 0) {
      this.host.fail(`An anonymous .segment requires :size`, ts[0]);
    }
    const memory = this.host.parseConst(ts.slice(0, colon), 0);
    let size;
    let fill;
    let bank;
    let bss = false;
    let addressing;
    for (const [key, val] of parseAttrList(ts, colon)) {
      const rejected = ANON_SEGMENT_ATTR_REASONS.get(key);
      if (rejected != null) {
        this.host.fail(`Segment attr ${key} is not allowed on an anonymous .segment` + (rejected ? `: ${rejected}` : ""), ts[0]);
      }
      switch (key) {
        case "size":
          size = this.host.parseConst(val, 0);
          break;
        case "fill":
          fill = val.length ? this.host.parseConst(val, 0) : 0;
          break;
        case "bank":
          bank = this.host.parseConst(val, 0);
          break;
        case "zp":
        case "zeropage":
          addressing = 1;
          bss = true;
          break;
        case "bss":
          bss = this.parseFlag(val, key);
          break;
        case "ro":
        case "rw":
          break;
        default:
          this.host.fail(`Unknown segment attr: ${key}`, ts[0]);
      }
    }
    if (size === undefined) {
      this.host.fail(`An anonymous .segment requires :size`, ts[0]);
    }
    if (bss && fill !== undefined) {
      this.host.fail(`Segment attr fill is not allowed on an anonymous ram ` + `segment: a ram segment writes nothing to the file`, ts[0]);
    }
    const seg = {
      name: this.generateAnonSegmentName(memory, size),
      memory,
      size
    };
    if (bss)
      seg.bss = true;
    if (addressing !== undefined)
      seg.addressing = addressing;
    if (bank !== undefined)
      seg.bank = bank;
    if (fill !== undefined) {
      seg.fill = fill;
      seg.free = [[memory, memory + size]];
    }
    return seg;
  }
  parseShorthandMirroredSegment(ts) {
    const segnames = ts.slice(1).filter((t) => !(t.token === "op" && t.str === "&")).map((t) => expectString(t)).sort();
    const mirror = this.checkCompositeMembers(segnames, "mirror", ts[0]);
    const seg = {
      name: mirror.join("&"),
      mirror
    };
    return [seg];
  }
}

// src/frontend/globals.ts
class GlobalTable {
  late;
  lateAssemblyQueries;
  globals = new Map;
  resolvedGlobalKinds = new Map;
  zeropageGlobals = new Set;
  commandLineDefines = new Set;
  autoimportEnabled = true;
  autoImported = [];
  constructor(late, lateAssemblyQueries) {
    this.late = late;
    this.lateAssemblyQueries = lateAssemblyQueries;
  }
  declare(ident, kind, scope, weak = false) {
    const decls = this.globals.get(ident);
    const existing = decls?.find((d) => d.scope === scope);
    if (existing && weak)
      return false;
    if (kind === "import" && this.commandLineDefines.delete(ident)) {
      scope.global.symbols.delete(ident);
    }
    if (existing) {
      existing.kind = kind;
    } else if (decls) {
      decls.push({ scope, kind });
    } else {
      this.globals.set(ident, [{ scope, kind }]);
    }
    return true;
  }
  markZeropage(ident) {
    this.zeropageGlobals.add(ident);
  }
  isZeropage(name) {
    return this.zeropageGlobals.has(name);
  }
  markCommandLineDefine(ident) {
    this.commandLineDefines.add(ident);
  }
  hasGlobalKind(name, kind) {
    return this.globals.get(name)?.some((d) => d.kind === kind) ?? false;
  }
  isMultiScope(name) {
    return (this.globals.get(name)?.length ?? 0) > 1;
  }
  isImportRef(name) {
    return this.hasGlobalKind(name, "import") || Boolean(this.late.autoImportNames?.has(name));
  }
  unresolvedImportIn(expr) {
    if (expr.op === "sym" || expr.op === "im") {
      const name = expr.sym;
      return name && this.isImportRef(name) && !this.zeropageGlobals.has(name) ? name : undefined;
    }
    if (expr.op === "+" || expr.op === "-") {
      for (const a of expr.args ?? []) {
        const name = this.unresolvedImportIn(a);
        if (name)
          return name;
      }
    }
    return;
  }
  lateImport(name, sym) {
    const linkEnv = this.late.linkEnv;
    if (!linkEnv)
      return;
    const declared = this.globals.has(name);
    if (!(this.hasGlobalKind(name, "import") || this.hasGlobalKind(name, "global") && this.late.globalKinds?.[name] === "import" || !declared && this.late.autoImportNames?.has(name))) {
      return;
    }
    const expr = { op: "im", sym: name };
    const at = firstRef(sym);
    if (at)
      expr.source = at;
    if (this.zeropageGlobals.has(name) || linkEnv.addrSize(name) === 1) {
      expr.meta = { size: 1 };
    }
    sym.expr = expr;
    return expr;
  }
  resolve(allocSymbol, collector) {
    for (const [name, decls] of this.globals) {
      for (const { scope, kind: global } of decls) {
        let sym = scope.symbols.get(name);
        for (let s = scope.parent;s && sym == null; s = s.parent) {
          const outer = s.symbols.get(name);
          if (outer?.expr)
            sym = outer;
        }
        const kind = global === "global" ? sym?.expr && sym.expr.op !== "im" ? "export" : "import" : global;
        if (global === "global")
          this.resolvedGlobalKinds.set(name, kind);
        if (kind === "export") {
          if (!sym?.expr) {
            collector.add("error", `Exported symbol '${name}' undefined`, firstRef(sym));
            continue;
          }
          if (sym.id == null)
            allocSymbol(sym);
          sym.export = name;
          const outer = scope.global.symbols.get(name);
          if (outer && outer !== sym && !outer.expr) {
            outer.expr = { op: "sym", num: sym.id };
          }
        } else if (kind === "import") {
          if (!sym)
            continue;
          if (sym.expr && sym.expr.op !== "im") {
            collector.add("error", `Symbol '${name}' already defined`, firstRef(sym));
            continue;
          }
          if (!sym.expr) {
            const expr = { op: "im", sym: name };
            const at = firstRef(sym);
            if (at)
              expr.source = at;
            if (this.zeropageGlobals.has(name))
              expr.meta = { size: 1 };
            sym.expr = expr;
          }
        } else {
          assertNever(kind);
        }
      }
    }
  }
  importUndefined(scope, collector) {
    for (const [name, sym] of scope.symbols) {
      if (sym.expr)
        continue;
      if (this.autoimportEnabled) {
        this.autoImport(name, sym);
      } else {
        collector.add("error", `Symbol '${name}' undefined`, firstRef(sym));
      }
    }
  }
  autoImport(name, sym) {
    const expr = { op: "im", sym: name };
    const at = firstRef(sym);
    if (at)
      expr.source = at;
    const answer = this.late.linkEnv?.addrSize(name);
    if (answer != null) {
      if (answer === 1)
        expr.meta = { size: 1 };
    } else {
      this.lateAssemblyQueries.push({ name, guess: 2, source: at });
    }
    sym.expr = expr;
    this.autoImported.push({ name, source: at });
  }
  resolvedKinds() {
    return Object.fromEntries(this.resolvedGlobalKinds);
  }
}

// src/frontend/debugtables.ts
var DATA_ELEMENTS = new Map([
  [".byte", { size: 1, type: "20" }],
  [".word", { size: 2, type: "21" }],
  [".dbyt", { size: 2, type: "51" }],
  [".faraddr", { size: 3, type: "4200" }]
]);
function arrayType(count, element) {
  let sizeBytes = "";
  let n = count;
  let bytes = 0;
  do {
    sizeBytes += (n & 255).toString(16).toUpperCase().padStart(2, "0");
    n = Math.floor(n / 256);
    bytes++;
  } while (n);
  const head = (128 | bytes - 1).toString(16).toUpperCase().padStart(2, "0");
  return head + sizeBytes + element;
}

class DebugBuilder {
  files = [];
  lines = [];
  lineSets = [];
  types = [];
  fileIds = new Map;
  lineIds = new Map;
  setTrie = {};
  typeIds = new Map;
  ext;
  hasFile(name) {
    return this.fileIds.has(name);
  }
  declareFile(name, size, mtime) {
    const file = this.files[this.fileId(name)];
    file.size = size;
    file.mtime = mtime;
  }
  fileId(name) {
    let id = this.fileIds.get(name);
    if (id === undefined) {
      id = this.files.length;
      this.files.push({ name, size: 0, mtime: 0 });
      this.fileIds.set(name, id);
    }
    return id;
  }
  line(file, line, type, count) {
    let ids = this.lineIds.get(file);
    if (!ids)
      this.lineIds.set(file, ids = new Map);
    const key = (line * 4 + type) * 65536 + count;
    let id = ids.get(key);
    if (id === undefined) {
      id = this.lines.length;
      this.lines.push({ file: this.fileId(file), line, type, count });
      ids.set(key, id);
    }
    return id;
  }
  lineId(src) {
    return this.lineChain(src)[0];
  }
  lineSet(src) {
    return this.internSet(this.fullChain(src));
  }
  fullChain(src, ext = this.ext) {
    const ids = this.lineChain(src);
    if (ext)
      ids.push(this.line(ext.file, ext.line, DEBUG_LINE_EXT, 0));
    return ids;
  }
  lineChain(src) {
    const ids = [];
    let depth = ancestors(src);
    for (let s = src;s; s = s.parent, depth--) {
      if (s.repeat && s.repeatEnd) {
        ids.push(this.line(s.file, s.line, DEBUG_LINE_ASM, s.repeat));
        ids.push(...this.lineChain(s.repeatEnd));
        break;
      }
      ids.push(this.line(s.file, s.line, depth ? DEBUG_LINE_MACRO : DEBUG_LINE_ASM, depth));
    }
    return ids;
  }
  asmLine(src) {
    let root = src;
    for (;; ) {
      while (root.parent)
        root = root.parent;
      if (!root.repeatEnd)
        break;
      root = root.repeatEnd;
    }
    return this.line(root.file, root.line, DEBUG_LINE_ASM, 0);
  }
  internSet(ids) {
    let node = this.setTrie;
    for (const line of ids) {
      const next = node.next ??= new Map;
      let child = next.get(line);
      if (!child)
        next.set(line, child = {});
      node = child;
    }
    if (node.set === undefined) {
      node.set = this.lineSets.length;
      this.lineSets.push(ids);
    }
    return node.set;
  }
  typeId(type) {
    let id = this.typeIds.get(type);
    if (id === undefined) {
      id = this.types.length;
      this.types.push(type);
      this.typeIds.set(type, id);
    }
    return id;
  }
  addRun(chunk, offset, size, set, type) {
    (chunk.debugRuns ??= []).push([set, offset, size, type]);
  }
}
function ancestors(src) {
  let n = 0;
  for (let s = src.parent;s; s = s.parent)
    n++;
  return n;
}
var encoder = new TextEncoder;
function utf8Length(s) {
  return encoder.encode(s).length;
}

// src/frontend/asmdebug.ts
function chainDepth(source) {
  let depth = 0;
  for (let s = source?.parent;s; s = s.parent)
    depth++;
  return depth;
}
function deepestSource(tokens) {
  let best;
  let bestDepth = -1;
  for (const { source } of tokens) {
    if (!source)
      continue;
    const depth = chainDepth(source);
    if (depth > bestDepth) {
      best = source;
      bestDepth = depth;
    }
  }
  return best;
}

class AssemblyDebug {
  host;
  tables = new DebugBuilder;
  source;
  dataElement;
  emittedCode = false;
  debugSyms = true;
  definedSyms = new Set;
  cheapSyms = [];
  setDefs = new Map;
  defLines = new Map;
  globalDecls = new Map;
  exportSites = new Map;
  pendingCondRefs = [];
  lastLabel;
  anonScopeCount = 0;
  unsizedSyms = new Set;
  csyms = [];
  debugLabels = [];
  constructor(moduleName, host) {
    this.host = host;
    if (moduleName)
      this.tables.fileId(moduleName);
  }
  startLine(tokens) {
    this.source = deepestSource(tokens);
  }
  noteLine(src) {
    if (src)
      this.tables.lineChain(src);
  }
  directive(name) {
    this.dataElement = DATA_ELEMENTS.get(name);
  }
  markEmitted(chunk, chunks) {
    this.dataElement = undefined;
    this.emittedCode = false;
    return { chunk, length: chunk?.data.length ?? 0, chunks };
  }
  recordRun(before, chunk, chunkIndex, src, scope) {
    if (!chunk || !src)
      return;
    if (chunk !== before.chunk && chunkIndex < before.chunks)
      return;
    const start = chunk === before.chunk ? before.length : 0;
    const size = chunk.data.length - start;
    if (size <= 0)
      return;
    const dbg = this.tables;
    const elem = this.dataElement;
    const type = elem && size % elem.size === 0 ? dbg.typeId(arrayType(size / elem.size, elem.type)) : this.emittedCode ? DEBUG_RUN_CODE : DEBUG_RUN_UNTYPED;
    if (start === 0 && !chunk.source)
      chunk.source = src;
    dbg.addRun(chunk, start, size, dbg.lineSet(this.source ?? src), type);
    const runs = scope.debugRuns ??= [];
    const last = runs[runs.length - 1];
    if (last && last[0] === chunkIndex && last[1] + last[2] === start) {
      last[2] += size;
    } else {
      runs.push([chunkIndex, start, size]);
    }
  }
  conditionRefs(expr, at, scope) {
    const walk = (e) => {
      if (e.op === ".sizeof")
        return;
      const source = e.source ?? at;
      if (e.op === "sym" && e.sym && e.sym !== "*" && source) {
        const sym = this.host.lookupSymbol(e.sym);
        if (sym) {
          (sym.refs ??= []).push(source);
        } else if (!e.sym.startsWith("@") && !e.sym.includes("::")) {
          this.pendingCondRefs.push({ name: e.sym, scope, source });
        }
      }
      e.args?.forEach(walk);
    };
    walk(expr);
  }
  closeLabelSpan(depth, sym) {
    if (sym && chainDepth(this.source) > depth)
      this.unsizedSyms.add(sym);
  }
  markUnsized(sym) {
    if (sym)
      this.unsizedSyms.add(sym);
  }
  anonLabel(dir, expr) {
    this.debugLabels.push({ name: dir === "+" ? "@p" : "@m", expr });
  }
  setLastLabel(sym) {
    this.lastLabel = sym;
  }
  define(ident, sym, expr, mut, isLabel, token) {
    const isCheapLocal = ident.startsWith("@");
    this.definedSyms.add(sym);
    const at = this.source ?? token;
    if (at) {
      const def = { src: at, ext: this.tables.ext };
      this.defLines.set(sym, mut ? [...this.defLines.get(sym) ?? [], def] : [def]);
    }
    if (mut && token) {
      const defs = this.setDefs.get(sym) ?? [];
      defs.push(token);
      this.setDefs.set(sym, defs);
    }
    if (isCheapLocal && isLabel && !mut) {
      this.cheapSyms.push({ name: ident, sym, parent: this.lastLabel });
    }
    if (isCheapLocal && isLabel)
      this.debugLabels.push({ name: ident, expr });
  }
  declareGlobal(ident, kind, source) {
    this.noteLine(this.source);
    if (!source)
      return;
    if (kind === "export") {
      const sites = this.exportSites.get(ident) ?? [];
      sites.push(source);
      this.exportSites.set(ident, sites);
    } else if (!this.globalDecls.has(ident)) {
      this.globalDecls.set(ident, source);
    }
  }
  nextAnonScope() {
    return ++this.anonScopeCount;
  }
  hasFunc(scope) {
    return this.csyms.some((c) => c.func && c.scope === scope);
  }
  addCSym(csym) {
    this.csyms.push(csym);
  }
  build(global) {
    const dbg = this.tables;
    for (const { name, scope, source } of this.pendingCondRefs) {
      for (let s = scope;s; s = s.parent) {
        const sym = s.symbols.get(name);
        if (!sym?.expr)
          continue;
        (sym.refs ??= []).push(source);
        break;
      }
    }
    const scopes = [];
    const syms = [];
    const scopeIds = new Map;
    const symIds = new Map;
    const order = [];
    const sizeOf = (expr) => {
      if (!expr)
        return;
      try {
        const r = this.host.resolve(expr);
        return r.op === "num" ? r.num : undefined;
      } catch {
        return;
      }
    };
    const gather = (scope, out) => {
      if (scope.debugRuns)
        out.push(...scope.debugRuns);
      for (const child of scope.children.values()) {
        if (!child.forwardDeclared)
          gather(child, out);
      }
      for (const child of scope.anonymousChildren)
        gather(child, out);
    };
    const merged = (runs) => {
      runs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const out = [];
      for (const run of runs) {
        const last = out[out.length - 1];
        if (last && last[0] === run[0] && last[1] + last[2] === run[1]) {
          last[2] += run[2];
        } else {
          out.push([run[0], run[1], run[2]]);
        }
      }
      return out;
    };
    const visit = (scope, parent) => {
      const id = scopes.length;
      scopeIds.set(scope, id);
      order.push(scope);
      const data = !scope.dbgType;
      const runs = data ? merged((() => {
        const all = [];
        gather(scope, all);
        return all;
      })()) : [];
      const entry = {
        name: scope.name ?? (scope.anonId ? `$anon-SCOPE-${scope.anonId.toString(16).toUpperCase().padStart(4, "0")}` : ""),
        size: scope.dbgType === "enum" ? 0 : sizeOf(scope.symbols.get(SIZE_NAME)?.expr) ?? runs.reduce((n, r) => n + r[2], 0),
        runs
      };
      if (parent !== undefined) {
        entry.parent = parent;
        entry.type = scope.dbgType ?? "scope";
      }
      scopes.push(entry);
      for (const child of scope.children.values()) {
        if (!child.forwardDeclared)
          visit(child, id);
      }
      for (const child of scope.anonymousChildren)
        visit(child, id);
    };
    visit(global);
    const addrSize = (name, sym) => {
      const expr = sym.expr;
      if (expr.op === "im")
        return this.host.isZeropageGlobal(name) ? "zeropage" : "absolute";
      if (expr.op === "num" && !expr.meta?.rel) {
        const n = expr.num;
        if (n >= 0 && n < 256)
          return "zeropage";
        if (n >= 0 && n < 65536)
          return "absolute";
        return n >= 0 && n < 16777216 ? "far" : "long";
      }
      return expr.meta?.zeropage || expr.meta?.size === 1 ? "zeropage" : "absolute";
    };
    const entryFor = (name, sym) => {
      const expr = sym.expr;
      const out = {
        name,
        addrsize: addrSize(name, sym),
        expr,
        kind: expr.op === "im" ? "imp" : sym.isLabel ? "lab" : "equ"
      };
      if (sym.export != null)
        out.export = true;
      const decl = expr.op === "im" ? this.globalDecls.get(name) : undefined;
      const defLines = this.defLines.get(sym) ?? (sym.def ? [{ src: sym.def }] : decl ? [{ src: decl }] : []);
      const defs = defLines.flatMap(({ src, ext }) => dbg.fullChain(src, ext));
      if (defs.length)
        out.defs = defs;
      const defTokens = this.setDefs.get(sym) ?? (sym.def ? [sym.def] : []);
      const refs = [
        ...(sym.refs ?? []).filter((r) => !defTokens.some((d) => d.file === r.file && d.line === r.line && d.column === r.column)),
        ...sym.export != null ? this.exportSites.get(name) ?? [] : []
      ].map((r) => dbg.asmLine(r));
      if (refs.length)
        out.refs = refs;
      return out;
    };
    for (const scope of order) {
      const scopeId = scopeIds.get(scope);
      for (const [name, sym] of scope.symbols) {
        if (isSizeOfSymbol(name) || !sym.expr || symIds.has(sym))
          continue;
        if (!this.definedSyms.has(sym) && sym.expr.op !== "im")
          continue;
        const entry = entryFor(name, sym);
        entry.scope = scopeId;
        const size = this.unsizedSyms.has(sym) ? undefined : sizeOf(scope.symbols.get(`${name}${SIZE_SUFFIX}`)?.expr);
        if (size)
          entry.size = size;
        symIds.set(sym, syms.length);
        syms.push(entry);
      }
    }
    for (const { name, sym, parent } of this.cheapSyms) {
      const parentId = parent && symIds.get(parent);
      if (parentId === undefined || !sym.expr)
        continue;
      const entry = entryFor(name, sym);
      entry.parent = parentId;
      syms.push(entry);
    }
    for (const scope of order) {
      if (!scope.label || !scope.parent)
        continue;
      const label = scope.parent.symbols.get(scope.label);
      const id = label && symIds.get(label);
      if (id !== undefined)
        scopes[scopeIds.get(scope)].label = id;
    }
    const hll = this.csyms.map((c) => {
      const out = {
        name: c.name,
        scope: scopeIds.get(c.scope) ?? 0,
        type: c.type,
        sc: c.sc
      };
      if (c.offs)
        out.offs = c.offs;
      const sym = c.asmName === undefined ? undefined : c.func ? c.scope.parent?.symbols.get(c.asmName) : this.findAnySymbol(c);
      const id = sym && symIds.get(sym);
      if (id !== undefined)
        out.sym = id;
      return out;
    });
    const { files, lines, lineSets, types } = dbg;
    if (!this.debugSyms) {
      return { files, lines, lineSets, types, scopes: [], syms: [], hll: [], lineOnly: true };
    }
    return { files, lines, lineSets, types, scopes, syms, hll };
  }
  findAnySymbol(c) {
    for (let s = c.scope;s; s = s.parent) {
      const sym = s.symbols.get(c.asmName);
      if (sym?.expr)
        return sym;
    }
    if (this.host.isImport(c.asmName))
      return;
    this.host.errorCollector.add("error", `Assembler symbol '${c.asmName}' not found`, c.source);
    return;
  }
  mlbSymbols(global) {
    const debugSymbols = [];
    let tempLabelCounter = 0;
    const usedNames = new Set;
    const makeUniqueName = (baseName) => {
      let uniqueName = `${baseName}_${tempLabelCounter}`;
      while (usedNames.has(uniqueName)) {
        tempLabelCounter++;
        uniqueName = `${baseName}_${tempLabelCounter}`;
      }
      usedNames.add(uniqueName);
      tempLabelCounter++;
      return uniqueName;
    };
    const collectSymbols = (scope) => {
      for (const [name, sym] of scope.symbols) {
        if (isSizeOfSymbol(name))
          continue;
        if (!sym.isLabel)
          continue;
        if (sym.expr != null) {
          const expr = { ...sym.expr };
          if (name.startsWith("@")) {
            const baseName = name.substring(1).replace(":", "");
            expr.sym = makeUniqueName(baseName);
          } else {
            if (!expr.sym) {
              expr.sym = name;
            }
            usedNames.add(expr.sym);
          }
          debugSymbols.push({ expr });
        }
      }
      for (const child of scope.children.values()) {
        collectSymbols(child);
      }
      for (const child of scope.anonymousChildren) {
        collectSymbols(child);
      }
    };
    collectSymbols(global);
    for (const { name, expr: originalExpr } of this.debugLabels) {
      const expr = { ...originalExpr };
      const baseName = name.substring(1).replace(":", "");
      expr.sym = makeUniqueName(baseName);
      debugSymbols.push({ expr });
    }
    return debugSymbols;
  }
}

// src/frontend/assembler.ts
var PREDECLARED_SEGMENTS = new Map([
  ["ZEROPAGE", { name: "ZEROPAGE", addressing: 1 }]
]);
var DEFERRABLE_LINK_OPS = new Set(["^", ".bankbyte", ".addrsize"]);
var SUPPORTED_CPUS = new Set(["6502", "6502x"]);
var DEFAULT_CPU_NAME = "6502";
var ASSERT_ACTIONS = new Map([
  ["warn", "warning"],
  ["warning", "warning"],
  ["error", "error"],
  ["ldwarn", "ldwarning"],
  ["ldwarning", "ldwarning"],
  ["lderror", "lderror"]
]);
var FUNC_CLASSES = new Map([
  ["extern", "ext"],
  ["static", "static"]
]);
var SYM_CLASSES = new Map([
  ["auto", "auto"],
  ["extern", "ext"],
  ["register", "reg"],
  ["static", "static"]
]);
var NO_INLINE_LOOKUP = { get: () => {
  return;
} };

class Assembler {
  cpu;
  opts;
  segments = [];
  segmentData = new Map;
  segmentOrg = new Map;
  segmentStack = [];
  symbols = [];
  structContext = [];
  deferredOps = new Map;
  pendingLabel;
  chars = new CharMap((msg) => this.fail(msg));
  cpuStack = [];
  currentScope = new Scope;
  cheapLocals = new CheapScope;
  localLabels = new LocalLabels(() => this.allocSymbol(), (msg) => this.fail(msg), (i) => this.linter?.rtsBackref(i));
  chunks = [];
  pendingAsserts = [];
  written = new IntervalSet;
  _chunk = undefined;
  _chunkIndex = -1;
  _name = undefined;
  _org = undefined;
  _pcShift = undefined;
  segmentShift = new Map;
  _pendingAlign = undefined;
  _pendingFill = undefined;
  _alignChunk = undefined;
  _source;
  dbg;
  errorToken;
  _ended = false;
  get ended() {
    return this._ended;
  }
  errorCollector = new ErrorCollector;
  lateAssemblyQueries = [];
  lateAssemblyCondQueries = [];
  linkEnv;
  localRefQueries = new Set;
  toleratedIfs = 0;
  inCondition = false;
  globalKinds;
  autoImportNames;
  linter;
  _exprMap = undefined;
  segParser;
  globals = new GlobalTable(this, this.lateAssemblyQueries);
  _segmentMode;
  constructor(cpu = Cpu.P02, opts = {}, late) {
    this.cpu = cpu;
    this.opts = opts;
    this.linkEnv = late?.linkEnv;
    this.globalKinds = late?.globalKinds;
    this.autoImportNames = late?.autoImportNames;
    if (opts.collectReferences || opts.generateDebugInfo) {
      this.currentScope.collectRefs = true;
      this.cheapLocals.collectRefs = true;
    }
    if (opts.generateDebugInfo) {
      this.dbg = new AssemblyDebug(opts.moduleName, {
        lookupSymbol: (name) => this.lookupSymbol(name),
        resolve: (expr) => this.resolve(expr),
        isZeropageGlobal: (name) => this.globals.isZeropage(name),
        isImport: (name) => this.globals.hasGlobalKind(name, "import"),
        errorCollector: this.errorCollector
      });
    }
    if (opts.errorLimit != null) {
      this.errorCollector.limit = opts.errorLimit;
    }
    if (opts.lint?.enabled !== false) {
      this.linter = new Linter(this.errorCollector, opts.lint, opts.tokenizerOptions?.lintPragmas);
    }
    this.segParser = new SegmentParser({
      fail: (msg, at) => this.fail(msg, at),
      parseConst: (tokens, start) => this.parseConst(tokens, start),
      parseStr: (tokens, start) => this.parseStr(tokens, start),
      parseOptionalStr: (tokens, start) => this.parseOptionalStr(tokens, start),
      source: () => this._source
    }, opts.moduleName);
  }
  setSource(source) {
    this._source = source;
  }
  get chunk() {
    this.ensureChunk();
    return this._chunk;
  }
  get exprMap() {
    return this._exprMap || (this._exprMap = new WeakMap);
  }
  get overwriteMode() {
    return this.opts.overwriteMode || "allow";
  }
  ensureChunk() {
    if (!this._chunk) {
      this._chunk = { segments: this.segments, data: [] };
      if (this._org != null)
        this._chunk.org = this._org;
      if (this._name)
        this._chunk.name = this._name;
      if (this._pendingAlign != null) {
        this._chunk.align = this._pendingAlign;
        this._pendingAlign = undefined;
        this._pendingFill = undefined;
        this._alignChunk = undefined;
      }
      this._chunk.overwrite = this.overwriteMode;
      if (this.opts.generateDebugInfo)
        this._chunk.labelIndex = new Map;
      if (this.segmentsAreZeropage()) {
        this._chunk.zeropage = true;
      }
      this._chunkIndex = this.chunks.length;
      this.chunks.push(this._chunk);
    }
  }
  clearChunk() {
    if (this._pcShift)
      this._pcShift = { base: this.shiftedPc(), at: 0 };
    this._chunk = undefined;
    this._chunkIndex = -1;
  }
  walkSymbolTree(sym) {
    let scope = this.currentScope;
    const unscoped = !sym.includes("::");
    do {
      const s = scope.resolve(sym, { allowForwardRef: false, missingScope: "undefined" });
      if (s)
        return s.expr;
    } while (unscoped && (scope = scope.parent));
    return;
  }
  definedSymbol(sym) {
    if (this.globals.hasGlobalKind(sym, "import"))
      return true;
    const s = this.walkSymbolTree(sym);
    if (s !== undefined)
      return Boolean(s);
    return false;
  }
  noteLine(src) {
    this.dbg?.noteLine(src);
  }
  conditionRefs(expr, at) {
    this.dbg?.conditionRefs(expr, at, this.currentScope);
  }
  definedValue(sym) {
    if (sym === "*")
      return this.pc();
    const expr = this.walkSymbolTree(sym);
    return expr && this.resolve(expr);
  }
  constantSymbol(sym) {
    const s = this.currentScope.resolve(sym, { allowForwardRef: false, missingScope: "undefined" });
    return Boolean(s && s.expr && !(s.id < 0));
  }
  referencedSymbol(sym) {
    const s = this.currentScope.resolve(sym, { allowForwardRef: false, missingScope: "undefined" });
    return s != null;
  }
  isMnemonic(name) {
    return this.cpu.names.has(name);
  }
  allowsPcAssignment() {
    return this.opts.pcAssignment ?? true;
  }
  allowsLabelWithoutColon() {
    return Boolean(this.opts.labelsWithoutColons) && !this.structContext.length;
  }
  allowsUbiquitousIdents() {
    return Boolean(this.opts.ubiquitousIdents);
  }
  allowsMultiOpsPerLine() {
    if (!this.opts.multiOpsPerLine)
      return false;
    if (this.opts.ubiquitousIdents) {
      this.fail(`js65_multiops_per_line cannot be combined with ubiquitous_idents`);
    }
    return true;
  }
  evaluate(expr) {
    expr = this.resolve(expr);
    if (expr.op === "num" && !expr.meta?.rel)
      return expr.num;
    return;
  }
  pc() {
    const shifted = this.shiftedPc();
    if (shifted != null) {
      const meta = {};
      if (this._chunk ? this._chunk.zeropage : this.segmentsAreZeropage()) {
        meta.zeropage = true;
      }
      return evaluate({ op: "num", num: shifted, meta });
    }
    return this.chunkPc();
  }
  chunkPc() {
    const num = this._chunk?.data.length ?? 0;
    const meta = {
      rel: true,
      chunk: this._chunk ? this._chunkIndex : this.chunks.length
    };
    const org = this._chunk?.org ?? this._org;
    if (org != null)
      meta.org = org;
    if (this._chunk ? this._chunk.zeropage : this.segmentsAreZeropage()) {
      meta.zeropage = true;
    }
    return evaluate({ op: "num", num, meta });
  }
  shiftedPc() {
    const s = this._pcShift;
    return s && s.base + (this._chunk?.data.length ?? 0) - s.at;
  }
  segmentsAreZeropage() {
    return this.segments.length > 0 && this.segments.every((s) => this.segmentData.get(s)?.addressing === 1);
  }
  symbolLookup = {
    get: (name) => this.lookupSymbol(name),
    zeropage: (name) => this.isZeropageRef(name),
    ref: (name, source) => {
      if (!source || !this.currentScope.collectRefs)
        return;
      const sym = this.lookupSymbol(name);
      if (sym)
        (sym.refs ??= []).push(source);
    }
  };
  symbol(name) {
    return evaluate(parseOnly([{ token: "ident", str: name }], 0, this.symbolLookup));
  }
  where() {
    if (!this._chunk)
      return "";
    if (this.chunk.org == null)
      return "";
    return `${this.chunk.segments.join(",")}:$${(this.chunk.org + this.chunk.data.length).toString(16)}`;
  }
  _evalEnv;
  segmentsForChunk(chunkIndex) {
    if (chunkIndex === this._chunkIndex)
      return this._chunk?.segments;
    const chunk = this.chunks[chunkIndex];
    if (chunk)
      return chunk.segments;
    if (chunkIndex === this.chunks.length && this.segments.length) {
      return this.segments;
    }
    return;
  }
  evalEnv() {
    return this._evalEnv ??= {
      addrSize: (sym) => {
        const segs = this.linkEnv?.localForwardRefs?.get(sym);
        return segs ? this.linkEnv?.segmentAddrSize?.(segs) : this.linkEnv?.addrSize(sym);
      },
      bank: (sym) => {
        const segs = this.linkEnv?.localForwardRefs?.get(sym);
        return segs ? this.linkEnv?.segmentBank(segs) : this.linkEnv?.bank(sym);
      },
      chunkBank: (chunkIndex) => {
        const segs = this.segmentsForChunk(chunkIndex);
        return segs && this.linkEnv?.segmentBank(segs);
      }
    };
  }
  localRefKey(name) {
    if (name.startsWith("@"))
      return;
    if (parseSymbol(name).type !== "none")
      return;
    if (name.includes("::")) {
      const picked = this.currentScope.pickScope(name, undefined, "undefined");
      if (!picked)
        return;
      const [tail, scope] = picked;
      return scope.qualifiedPrefix() + tail;
    }
    for (let scope = this.currentScope;scope; scope = scope.parent) {
      const sym = scope.symbols.get(name);
      if (sym)
        return scope.qualifiedPrefix() + name;
    }
    return this.currentScope.qualifiedPrefix() + name;
  }
  resolve(expr) {
    if (expr.op === "num" && !expr.args && !(expr.meta?.rel && expr.meta.org != null)) {
      return expr;
    }
    const out = traverse(expr, (e, rec) => {
      if (e.op === ".sizeof" && e.args?.length === 1 && e.args[0].sym) {
        const replacement = this.sizeOf(e.args[0].sym);
        if (replacement)
          return evaluate(rec(replacement));
        this.deferredOps.set(e, { kind: "sizeof", scope: this.currentScope });
        return e;
      }
      if (DEFERRABLE_LINK_OPS.has(e.op) && e.args?.length === 1 && e.args[0].op === "sym" && e.args[0].sym != null) {
        const key = this.localRefKey(e.args[0].sym) ?? e.args[0].sym;
        if (this.inCondition)
          this.localRefQueries.add(key);
        if (this.linkEnv?.localForwardRefs?.has(key)) {
          return evaluate({ ...e, args: [{ ...e.args[0], sym: key }] }, this.evalEnv());
        }
      }
      while (e.op === "sym" && e.sym) {
        e = this.resolveSymbol(e);
      }
      e = this.substituteResolvedRef(e);
      const recursed = rec(e);
      const out = evaluate(recursed, this.evalEnv());
      if (out === recursed && DEFERRABLE_LINK_OPS.has(recursed.op) && recursed.args?.length === 1) {
        const arg = recursed.args[0];
        if (arg.op === "sym" && arg.sym == null && arg.num != null) {
          this.deferredOps.set(out, { kind: "link" });
        }
      }
      return out;
    });
    if (this.opts.refExtractor?.ref && out !== expr) {
      const orig = this.exprMap.get(expr) || expr;
      this.exprMap.set(out, orig);
    }
    return out;
  }
  substituteResolvedRef(expr) {
    let seen;
    let first;
    while (expr.op === "sym" && expr.sym == null && expr.num != null) {
      const num = expr.num;
      if (seen) {
        if (seen.has(num))
          break;
        seen.add(num);
      } else if (first === undefined) {
        first = num;
      } else {
        if (first === num)
          break;
        seen = new Set([first, num]);
      }
      const value = this.symbols[num]?.expr;
      if (!value)
        break;
      expr = value;
    }
    return expr;
  }
  defineSizeOfSymbol(scope, name, size2) {
    const expr = typeof size2 === "number" ? { op: "num", num: size2, meta: size(size2) } : size2;
    scope.symbols.set(`${name}${SIZE_SUFFIX}`, { expr });
  }
  defineSizeOfScope(scope, name, size) {
    scope.symbols.set(SIZE_NAME, { expr: size });
    if (name && scope.parent)
      this.defineSizeOfSymbol(scope.parent, name, size);
  }
  sizeOf(name) {
    const scope = this.currentScope.findScope(name);
    if (scope)
      return scope.symbols.get(SIZE_NAME)?.expr;
    return this.lookupSizeOfSymbol(name)?.expr;
  }
  lookupSizeOfSymbol(name) {
    const split = name.split(RE_SCOPE_SPLIT);
    const tail = split.pop();
    if (split.length) {
      const owner = this.currentScope.findScope(split.join("::"));
      return owner?.symbols.get(`${tail}${SIZE_SUFFIX}`);
    }
    for (let s = this.currentScope;s; s = s.parent) {
      const sym = s.symbols.get(`${tail}${SIZE_SUFFIX}`);
      if (sym)
        return sym;
    }
    return;
  }
  sizeSpan(startPc, endPc) {
    const first = startPc.meta?.chunk;
    const last = endPc.meta?.chunk;
    if (first === last)
      return { op: "-", args: [endPc, startPc] };
    if (first == null || last == null) {
      this.fail(`Cannot determine size across chunks`, this.errorToken);
    }
    if (first >= this.chunks.length || first > last) {
      const total = this.offsetIn(endPc, last);
      return { op: "num", num: total, meta: size(total) };
    }
    let total = this.chunkLength(first) - this.offsetIn(startPc, first);
    for (let i = first + 1;i < last; i++)
      total += this.chunkLength(i);
    total += this.offsetIn(endPc, last);
    return { op: "num", num: total, meta: size(total) };
  }
  chunkLength(chunk) {
    return this.chunks[chunk].data.length;
  }
  offsetIn(pc, chunk) {
    return pc.num - (pc.meta?.rel ? 0 : this.chunks[chunk].org ?? 0);
  }
  allocSymbol(sym = {}) {
    sym.id = this.symbols.length;
    this.symbols.push(sym);
    return sym;
  }
  resolveSymbol(symbol) {
    const name = symbol.sym;
    const parsed = parseSymbol(name);
    if (parsed.type === "pc") {
      return this.pc();
    } else if (parsed.type !== "none") {
      const local = this.localLabels.resolve(name, parsed);
      if (local)
        return local;
    }
    const scope = name.startsWith("@") ? this.cheapLocals : this.currentScope;
    const ref = symbol.source || !this.dbg ? symbol : { source: this.dbg.source };
    const sym = scope.resolve(name, { allowForwardRef: true, ref });
    if (sym.expr) {
      return sym.expr;
    }
    const imported = this.globals.lateImport(name, sym);
    if (imported)
      return imported;
    if (sym.id == null)
      this.allocSymbol(sym);
    const out = { op: "sym", num: sym.id };
    if (symbol.meta?.zeropage)
      out.meta = { zeropage: true };
    return out;
  }
  chunkData(chunk) {
    return { org: this.chunks[chunk].org };
  }
  closeScopes() {
    const collector = this.errorCollector;
    this.cheapLocals.clear(collector);
    const close = (scope) => {
      for (const child of scope.children.values()) {
        close(child);
      }
      for (const child of scope.anonymousChildren) {
        close(child);
      }
      for (const [name, sym] of scope.symbols) {
        if (sym.expr || sym.id == null)
          continue;
        if (scope.parent) {
          if (sym.scoped) {
            collector.add("error", `Symbol '${name}' undefined`, firstRef(sym));
            continue;
          }
          const parentSym = scope.parent.symbols.get(name);
          const multiScopeGlobal = this.globals.isMultiScope(name);
          if (!parentSym) {
            if (!multiScopeGlobal)
              scope.parent.symbols.set(name, sym);
          } else if (multiScopeGlobal) {} else {
            if (this.dbg && sym.refs)
              (parentSym.refs ??= []).push(...sym.refs);
            if (parentSym.id != null && parentSym.id >= 0) {
              sym.expr = { op: "sym", num: parentSym.id };
            } else if (parentSym.expr) {
              sym.expr = parentSym.expr;
            } else {
              collector.add("error", `Internal error: symbol '${name}' has neither id nor expr`, firstRef(sym));
            }
          }
        }
      }
    };
    if (this.currentScope.parent) {
      collector.add("error", `Scope never closed`);
    }
    close(this.currentScope);
    this.globals.resolve((sym) => this.allocSymbol(sym), collector);
    this.globals.importUndefined(this.currentScope, collector);
    this.resolveDeferredOps();
  }
  resolveDeferredOps() {
    if (!this.deferredOps.size)
      return;
    const saved = this.currentScope;
    const fix = (expr) => traverse(expr, (e, rec) => {
      const op = this.deferredOps.get(e);
      if (op?.kind === "sizeof" && e.args?.[0]?.sym) {
        const name = e.args[0].sym;
        this.currentScope = op.scope;
        try {
          const replacement = this.sizeOf(name);
          if (!replacement) {
            this.fail(`Size of '${name}' is unknown`, this.errorToken);
          }
          return evaluate(this.resolve(replacement));
        } finally {
          this.currentScope = saved;
        }
      }
      if (op?.kind === "link" && e.args?.length === 1) {
        const arg = this.substituteResolvedRef(e.args[0]);
        return evaluate({ ...e, args: [arg] }, this.evalEnv());
      }
      return evaluate(rec(e));
    });
    for (const chunk of this.chunks) {
      if (chunk.subs) {
        for (const sub of chunk.subs)
          sub.expr = fix(sub.expr);
      }
    }
    for (const a of this.pendingAsserts) {
      a.expr = fix(a.expr);
    }
    for (const symbol of this.symbols) {
      if (symbol.expr)
        symbol.expr = fix(symbol.expr);
    }
    this.deferredOps.clear();
  }
  module() {
    this.flushPendingAlign();
    this.closeScopes();
    this.linter?.closeModule();
    this.checkAssertions();
    const chunks = [];
    for (const chunk of this.chunks) {
      chunks.push({ ...chunk, data: Uint8Array.from(chunk.data) });
    }
    const symbols = [];
    for (const symbol of this.symbols) {
      if (symbol.expr == null) {
        continue;
      }
      const out = { expr: symbol.expr };
      if (symbol.export != null)
        out.export = symbol.export;
      symbols.push(out);
    }
    const segments = [...this.segmentData.values()];
    const debugSymbols = this.dbg?.mlbSymbols(this.currentScope.global);
    const lateAssembly = this.lateAssemblyQueries.length || this.lateAssemblyCondQueries.length ? {
      sizeQueries: this.lateAssemblyQueries,
      condQueries: this.lateAssemblyCondQueries,
      globalKinds: this.globals.resolvedKinds(),
      opts: this.opts
    } : undefined;
    const autoImports = this.globals.autoImported.length ? this.globals.autoImported : undefined;
    const debug = this.dbg?.build(this.currentScope.global);
    return { chunks, symbols, segments, debugSymbols, debug, lateAssembly, autoImports };
  }
  collectLocalSegments() {
    const out = new Map;
    const visit = (scope, prefix) => {
      for (const [name, sym] of scope.symbols) {
        if (isSizeOfSymbol(name) || name.startsWith("@"))
          continue;
        const chunkIndex = sym.expr?.meta?.chunk;
        if (chunkIndex == null)
          continue;
        const segs = this.chunks[chunkIndex]?.segments;
        if (segs)
          out.set(prefix + name, segs);
      }
      for (const [name, child] of scope.children)
        visit(child, `${prefix}${name}::`);
      for (const child of scope.anonymousChildren)
        visit(child, prefix);
    };
    visit(this.currentScope.global, "");
    return out;
  }
  line(tokens) {
    this.dbg?.startLine(tokens);
    if (eq(tokens[1], ASSIGN) || eq(tokens[1], ASSIGN_LABEL) || eq(tokens[1], SET)) {
      this.assignment(tokens);
      return;
    }
    this._source = tokens[0].source;
    const before = this.dbg?.markEmitted(this._chunk, this.chunks.length);
    const isLabel = tokens.length < 3 && eq(tokens[tokens.length - 1], COLON) && !(tokens[0].token === "ident" && this.isMnemonic(tokens[0].str) && !this.allowsUbiquitousIdents());
    try {
      if (this.structContext.length && tokens[0].token === "ident") {
        this.structMember(tokens);
      } else if (isLabel) {
        this.label(tokens[0]);
      } else if (tokens[0].token === "cs") {
        this.directive(tokens);
      } else {
        this.instruction(tokens);
      }
    } catch (err) {
      this.recoverLine(err);
    } finally {
      if (!isLabel)
        this.closeLabelSpan();
    }
    if (before) {
      this.dbg.recordRun(before, this._chunk, this._chunkIndex, this._source, this.currentScope);
    }
  }
  assignment(tokens) {
    try {
      if (tokens[0].token === "op" && tokens[0].str === "*") {
        this._source = tokens[0].source;
        this.assignPc(this.parseConst(tokens, 2));
      } else if (eq(tokens[1], SET)) {
        this.setLine(tokens);
      } else {
        this.assignLine(tokens);
      }
    } catch (err) {
      this.recoverLine(err);
    }
  }
  recoverLine(err) {
    if (err instanceof FatalError)
      throw err;
    if (err instanceof RecoverableError) {
      return;
    }
    if (err instanceof SourceError) {
      this.errorCollector.addFromException(err, err.source ?? this._source);
      return;
    }
    const located = SourceError.locate(err, this._source);
    if (!(located instanceof SourceError))
      throw located;
    const fatal = new FatalError(located.message, located.source);
    fatal.stack = located.stack;
    throw fatal;
  }
  tokens(source, signal) {
    while (!this._ended) {
      if (signal?.aborted)
        throw new FatalError("Compilation cancelled");
      const line = source.next();
      if (!line)
        break;
      this.line(line);
    }
  }
  directive(tokens) {
    this.errorToken = tokens[0];
    this.dbg?.directive(str(tokens[0]));
    this.linter?.endInstructionSequence();
    try {
      switch (str(tokens[0])) {
        case ".if":
        case ".elseif":
        case ".else":
        case ".endif":
          throw new Error(`${str(tokens[0])} must be handled by the preprocessor`);
        case ".org":
          return this.org(this.parseConst(tokens, 1));
        case ".reloc":
          return this.parseNoArgs(tokens, 1), this.reloc();
        case ".assert": {
          const [expr, action, message] = this.parseAssert(tokens);
          return this.assert(expr, action, message);
        }
        case ".segment":
          return this.segmentInternal(this.parseSegmentList(tokens, 1, false));
        case ".byte":
          return this.byteInternal(this.parseDataList(tokens, true));
        case ".hibytes":
          return this.byteInternal(this.parseDataList(tokens).map((e) => hiByte(e)));
        case ".lobytes":
          return this.byteInternal(this.parseDataList(tokens).map((e) => loByte(e)));
        case ".bytestr":
          return this.byteInternal(this.parseByteStr(tokens));
        case ".literal":
          return this.byteInternal(this.parseDataList(tokens, true), new MaxKeySizeCacheMap);
        case ".res": {
          const [count, value] = this.parseResArgs(tokens);
          return this.res(count, value);
        }
        case ".word":
          return this.wordInternal(this.parseDataList(tokens));
        case ".dbyt":
          return this.dbyteInternal(this.parseDataList(tokens));
        case ".faraddr":
          return this.faraddrInternal(this.parseDataList(tokens));
        case ".dword":
          return this.dwordInternal(this.parseDataList(tokens));
        case ".free":
          return this.free(this.parseConst(tokens, 1));
        case ".jsaction":
          return this.jsAction(tokens);
        case ".segmentprefix":
          return this.segmentPrefix(this.parseStr(tokens, 1));
        case ".import":
          return this.importInternal(this.parseIdentifierList(tokens));
        case ".export":
          return this.exportInternal(this.parseIdentifierList(tokens));
        case ".importzp":
          return this.importzpInternal(this.parseIdentifierList(tokens));
        case ".exportzp":
          return this.exportzpInternal(this.parseIdentifierList(tokens));
        case ".global":
          return this.globalInternal(this.parseIdentifierList(tokens));
        case ".globalzp":
          return this.globalzpInternal(this.parseIdentifierList(tokens));
        case ".charmap":
          return this.charmap(tokens);
        case ".strmap":
          return this.strmap(tokens);
        case ".pushcharmap":
          return this.parseNoArgs(tokens, 1), this.pushCharmap();
        case ".popcharmap":
          return this.parseNoArgs(tokens, 1), this.popCharmap();
        case ".setcpu":
          return this.setCpu(this.parseStr(tokens, 1));
        case ".pushcpu":
          return this.parseNoArgs(tokens, 1), this.pushCpu();
        case ".popcpu":
          return this.parseNoArgs(tokens, 1), this.popCpu();
        case ".asciiz":
          return this.asciizInternal(this.parseDataList(tokens, true));
        case ".align":
          return this.alignDir(tokens);
        case ".struct":
          return this.beginStruct(tokens, "struct");
        case ".union":
          return this.beginStruct(tokens, "struct");
        case ".enum":
          return this.beginStruct(tokens, "enum");
        case ".endstruct":
          return this.parseNoArgs(tokens, 1), this.endStruct("struct", tokens[0].source);
        case ".endunion":
          return this.parseNoArgs(tokens, 1), this.endStruct("struct", tokens[0].source);
        case ".endenum":
          return this.parseNoArgs(tokens, 1), this.endStruct("enum", tokens[0].source);
        case ".scope":
          return this.scope(this.parseOptionalIdentifier(tokens), tokens[0].source);
        case ".endscope":
          return this.parseNoArgs(tokens, 1), this.endScope(tokens[0].source);
        case ".proc":
          return this.proc(this.parseProcName(tokens), tokens[0].source);
        case ".endproc":
          return this.parseNoArgs(tokens, 1), this.endProc(tokens[0].source);
        case ".pushseg":
          return this.pushSegInternal(this.parseSegmentList(tokens, 1, true));
        case ".popseg":
          return this.parseNoArgs(tokens, 1), this.popSeg();
        case ".move": {
          const [size, source] = this.parseMoveArgs(tokens);
          return this.move(size, source);
        }
        case ".end":
          return this.parseNoArgs(tokens, 1), void (this._ended = true);
        case ".out":
          return this.log("info", tokens);
        case ".warning":
          return this.log("warn", tokens);
        case ".error":
          return this.log("error", tokens);
        case ".fatal":
          return this.log("error", tokens, true);
        case ".feature":
          return this.feature(tokens);
        case ".dbg":
          return this.dbgDirective(tokens);
        case ".debuginfo": {
          const on = this.parseBoolOption(tokens);
          if (this.dbg)
            this.dbg.debugSyms = on;
          return;
        }
        case ".autoimport":
          return this.autoimport(tokens);
        case ".a8":
        case ".i8":
        case ".p02":
          return;
        case ".zeropage":
          return this.parseNoArgs(tokens, 1), this.segment("ZEROPAGE");
        case ".code":
          return this.parseNoArgs(tokens, 1), this.segment("CODE");
        case ".data":
          return this.parseNoArgs(tokens, 1), this.segment("DATA");
        case ".rodata":
          return this.parseNoArgs(tokens, 1), this.segment("RODATA");
        case ".bss":
          return this.parseNoArgs(tokens, 1), this.segment("BSS");
        case ".list":
        case ".listbytes":
        case ".pagelength":
        case ".fileopt":
        case ".smart":
        case ".linecont":
        case ".localchar":
        case ".case":
        case ".condes":
        case ".constructor":
        case ".destructor":
        case ".interruptor":
          return;
      }
      this.fail(`Unknown directive: ${nameOf(tokens[0])}`, tokens[0]);
    } finally {
      this.errorToken = undefined;
    }
  }
  lateCondition(tokens) {
    const at = tokens[0];
    if (!this.linkEnv) {
      this.lateAssemblyCondQueries.push({ source: at.source });
      return;
    }
    const expr = this.parseExpr(tokens, 1);
    const prev = this.inCondition;
    this.inCondition = true;
    let value;
    try {
      value = this.evaluate(expr);
    } finally {
      this.inCondition = prev;
    }
    if (value == null) {
      if (this.linkEnv.tolerateUnresolvedIf) {
        this.toleratedIfs++;
        return false;
      }
      this.fail(`Expected a constant`, at);
    }
    return value !== 0;
  }
  closeLabelSpan() {
    const pending = this.pendingLabel;
    if (!pending)
      return;
    this.pendingLabel = undefined;
    this.dbg?.closeLabelSpan(pending.depth, this.currentScope.symbols.get(pending.name));
    this.defineSizeOfSymbol(this.currentScope, pending.name, this.sizeSpan(pending.startPc, this.chunkPc()));
  }
  label(label) {
    let ident;
    let token;
    const expr = this.pc();
    if (typeof label === "string") {
      ident = label;
    } else {
      ident = str(token = label);
      if (label.source)
        expr.source = label.source;
    }
    this.linter?.label(ident);
    const dir = this.localLabels.label(ident, expr);
    if (dir) {
      this.dbg?.anonLabel(dir, expr);
      return;
    }
    if (!ident.startsWith("@")) {
      this.cheapLocals.clear();
      if (token && token.labelsData) {
        this.pendingLabel = { name: ident, startPc: this.chunkPc(), depth: chainDepth(this.dbg?.source) };
      } else {
        this.defineSizeOfSymbol(this.currentScope, ident, 0);
      }
      if (!this.chunk.name && !this.chunk.data.length)
        this.chunk.name = ident;
      if (this.opts.refExtractor?.label && this.chunk.org != null) {
        this.opts.refExtractor.label(ident, this.shiftedPc() ?? this.chunk.org + this.chunk.data.length, this.chunk.segments);
      }
      if (this.opts.generateDebugInfo && this._chunk?.labelIndex) {
        this._chunk.labelIndex.set(ident, this.chunk.data.length);
      }
    }
    this.assignSymbol(ident, false, expr, token, true);
    if (this.dbg && !ident.startsWith("@")) {
      this.dbg.setLastLabel(this.currentScope.symbols.get(ident));
    }
  }
  assignLine(tokens) {
    if (tokens[0].source) {
      this._source = tokens[0].source;
    }
    const name = str(tokens[0]);
    const expr = this.parseExpr(tokens, 2);
    const isLabel = eq(tokens[1], ASSIGN_LABEL);
    const ctx = this.structContext[this.structContext.length - 1];
    if (ctx?.kind !== "enum") {
      this.assign(name, expr, isLabel, tokens[0]);
      return;
    }
    const val = this.evaluate(expr);
    if (val == null) {
      this.fail(`enum member '${name}' needs a constant value`, tokens[0]);
    }
    this.enumMember(name, val, tokens[0]);
  }
  setLine(tokens) {
    if (tokens[0].source) {
      this._source = tokens[0].source;
    }
    this.set(str(tokens[0]), this.parseExpr(tokens, 2), tokens[0]);
  }
  assign(ident, expr, isLabel = false, token, kind) {
    if (typeof expr !== "number")
      expr = this.resolve(expr);
    this.assignSymbol(ident, false, expr, token, isLabel, kind);
    const num = typeof expr === "number" ? expr : expr.op === "num" ? expr.num : undefined;
    if (this.opts.refExtractor?.assign && num != null) {
      this.opts.refExtractor.assign(ident, num);
    }
  }
  set(ident, expr, token) {
    if (ident.startsWith("@")) {
      this.fail(`Cheap locals may only be labels: ${ident}`);
    }
    if (typeof expr !== "number")
      expr = this.resolve(expr);
    this.assignSymbol(ident, true, expr, token);
  }
  commandLineSet(ident, expr) {
    this.set(ident, expr);
    this.globals.markCommandLineDefine(ident);
  }
  assignSymbol(ident, mut, expr, token, isLabel = false, kind) {
    if (this.isMnemonic(ident) && !this.allowsUbiquitousIdents()) {
      this.fail(`Symbol may not be named after the instruction ${ident} ` + `(enable it with '.feature ubiquitous_idents')`, token);
    }
    if (typeof expr === "number")
      expr = { op: "num", num: expr, meta: size(expr) };
    if (this._source && !expr.source) {
      expr.source = this._source;
    }
    const isCheapLocal = ident.startsWith("@");
    const scope = isCheapLocal ? this.cheapLocals : this.currentScope;
    let sym = scope.resolve(ident, { allowForwardRef: !mut, ref: token });
    if (sym && mut !== sym.id < 0) {
      this.fail(`Cannot change mutability of ${ident}`, token);
    } else if (mut && expr.op != "num") {
      this.fail(`Mutable set requires constant`, token);
    } else if (!sym) {
      if (!mut)
        throw new Error(`impossible`);
      sym = scope.declare(ident, { id: -1 }, token);
    } else if (!mut && sym.expr) {
      const orig = sym.expr.source ? `
Originally defined${at(sym.expr)}` : "";
      this.fail(`Redefining symbol ${ident}${orig}`, token);
    }
    sym.expr = expr;
    if (isLabel)
      sym.isLabel = true;
    if (scope.collectRefs && token?.source) {
      sym.def = token.source;
    }
    this.dbg?.define(ident, sym, expr, mut, isLabel, token?.source);
    this.opts.symbolIndex?.recordSymbol(sym, ident, this.opts.moduleName, kind);
  }
  instruction(...args) {
    let mnemonic;
    let arg;
    let at;
    let tokens;
    if (args.length === 1 && Array.isArray(args[0])) {
      tokens = args[0];
      at = tokens[0];
      mnemonic = expectIdentifier(tokens[0]).toLowerCase();
      arg = this.parseArg(tokens, 1);
    } else if (typeof args[1] === "string") {
      mnemonic = args[0];
      const tokenizer = new Tokenizer(args[1]);
      arg = this.parseArg(tokenizer.next(), 0);
    } else {
      [mnemonic, arg] = args;
      if (!arg)
        arg = ["imp"];
      mnemonic = mnemonic.toLowerCase();
    }
    let rtsAnchor;
    if (mnemonic === "rts") {
      rtsAnchor = this.localLabels.rts(this.pc());
    }
    const ops = this.cpu.op(mnemonic);
    if (!ops)
      this.fail(`Bad mnemonic: ${mnemonic}`, at);
    this.linter?.instruction(mnemonic, arg, ops, tokens, rtsAnchor);
    const m = arg[0];
    if (m === "add" || m === "a,x" || m === "a,y") {
      let expr = arg[1];
      if (expr.meta?.size == null && expr.args) {
        expr = traversePost(expr, evaluate);
        if (expr.meta?.size == null && !expr.meta?.zeropage) {
          const name = this.globals.unresolvedImportIn(expr);
          if (name) {
            const answer = this.linkEnv?.addrSize(name);
            if (answer != null) {
              expr = { ...expr, meta: { ...expr.meta, size: answer } };
            } else {
              this.lateAssemblyQueries.push({ name, guess: 2, source: expr.source ?? this._source });
            }
          }
        }
        this.mapRef(arg[1], expr, (e) => e);
      }
      const s = expr.meta?.size ?? (expr.meta?.zeropage ? 1 : 2);
      if (m === "add" && s === 1 && "zpg" in ops) {
        return this.opcode(ops.zpg, 1, expr);
      } else if (m === "add" && "abs" in ops) {
        return this.opcode(ops.abs, 2, expr);
      } else if (m === "add" && "rel" in ops) {
        return this.relative(ops.rel, 1, expr);
      } else if (m === "a,x" && s === 1 && "zpx" in ops) {
        return this.opcode(ops.zpx, 1, expr);
      } else if (m === "a,x" && "abx" in ops) {
        return this.opcode(ops.abx, 2, expr);
      } else if (m === "a,y" && s === 1 && "zpy" in ops) {
        return this.opcode(ops.zpy, 1, expr);
      } else if (m === "a,y" && "aby" in ops) {
        return this.opcode(ops.aby, 2, expr);
      }
      this.fail(`Bad address mode ${m} for ${mnemonic}`);
    }
    if (m in ops) {
      const argLen = this.cpu.argLen(m);
      if (m === "rel")
        return this.relative(ops[m], argLen, arg[1]);
      return this.opcode(ops[m], argLen, arg[1]);
    }
    this.fail(`Bad address mode ${m} for ${mnemonic}`);
  }
  parseArg(tokens, start) {
    if (tokens.length === start)
      return ["imp"];
    const front = tokens[start];
    const next = tokens[start + 1];
    if (tokens.length === start + 1) {
      if (isRegister(front, "a"))
        return ["acc"];
    } else if (eq(front, IMMEDIATE)) {
      const size = addrSize(tokens, start + 1);
      if (size) {
        this.fail(`Cannot force ${ADDR_SIZE_NAMES[size.size]} addressing on ` + `imm arguments`, tokens[start + 1]);
      }
      return ["imm", this.parseExpr(tokens, start + 1)];
    }
    if (eq(front, COLON) && tokens.length === start + 2 && next.token === "op" && /^[-+]+$/.test(next.str)) {
      return ["add", { op: "sym", sym: ":" + next.str }];
    } else if (tokens.length === start + 1 && front.token === "op" && /^[-+]+$/.test(front.str)) {
      return ["add", { op: "sym", sym: front.str }];
    }
    const forced = addrSize(tokens, start);
    if (forced) {
      if (forced.size === "f") {
        this.fail(`Far addressing (\`f:\`) is 65816-only`, front);
      }
      const [mode, out] = this.parseArg(tokens, forced.next);
      const kind = ADDR_SIZE_NAMES[forced.size];
      if (mode === "acc" || mode === "imm" || mode === "imp") {
        this.fail(`Cannot force ${kind} addressing on ${mode} arguments`, front);
      }
      const lookup = forced.size === "z" ? ForceDirectAddressingMap : ForceAbsoluteAddressingMap;
      const adr = lookup.get(mode);
      if (!adr)
        this.fail(`Cannot force ${kind} addressing on ${mode} arguments`, front);
      return [adr, out];
    }
    if (eq(front, LP) || this.opts.allowBrackets && eq(front, LB)) {
      const close = findBalanced(tokens, start);
      if (close < 0)
        this.fail(`Unbalanced ${name(front)}`, front);
      const args = parseArgList(tokens, start + 1, close);
      if (!args.length)
        this.fail(`Bad argument`, front);
      const inner = args[0];
      const innerSize = addrSize(inner, 0);
      if (innerSize?.size === "f") {
        this.fail(`Far addressing (\`f:\`) is 65816-only`, inner[0]);
      }
      const expr = this.parseExpr(inner, innerSize?.next ?? 0);
      if (args.length === 1) {
        if (eq(tokens[close + 1], COMMA) && isRegister(tokens[close + 2], "y")) {
          expectEol(tokens[close + 3]);
          return ["iny", expr];
        }
        expectEol(tokens[close + 1]);
        return ["ind", expr];
      } else if (args.length === 2 && args[1].length === 1) {
        if (isRegister(args[1][0], "x"))
          return ["inx", expr];
      }
      this.fail(`Bad argument`, front);
    }
    const args = parseArgList(tokens, start);
    if (!args.length)
      this.fail(`Bad arg`, front);
    const expr = this.parseExpr(args[0], 0);
    if (args.length === 1)
      return ["add", expr];
    if (args.length === 2 && args[1].length === 1) {
      if (isRegister(args[1][0], "x"))
        return ["a,x", expr];
      if (isRegister(args[1][0], "y"))
        return ["a,y", expr];
    }
    this.fail(`Bad arg`, front);
  }
  relative(op, arglen, expr) {
    const shifted = this.shiftedPc();
    let nextPc;
    if (shifted != null) {
      nextPc = { op: "num", num: shifted + arglen + 1 };
    } else {
      const num = this.chunk.data.length + arglen + 1;
      const meta = { rel: true, chunk: this._chunkIndex };
      if (this._chunk?.org)
        meta.org = this._chunk.org;
      nextPc = { op: "num", num, meta };
    }
    const rel = { op: "-", args: [expr, nextPc], meta: { branch: true } };
    if (expr.source)
      rel.source = expr.source;
    this.mapRef(expr, rel, (e) => ({ ...rel, args: [e, nextPc] }));
    this.opcode(op, arglen, rel);
  }
  opcode(op, arglen, expr) {
    const isBranch = Boolean(expr?.meta?.branch);
    if (arglen)
      expr = this.resolve(expr);
    const { chunk } = this;
    this.markWritten(1 + arglen);
    if (this.dbg)
      this.dbg.emittedCode = true;
    chunk.data.push(op);
    if (arglen) {
      this.append(expr, arglen, isBranch);
    }
    if (!chunk.name)
      chunk.name = `Code`;
  }
  markWritten(size) {
    if (this._chunk?.org == null)
      return;
    const offset = this.orgToOffset(this._chunk.org);
    if (offset != null) {
      this.written.add(offset + this._chunk.data.length, offset + this._chunk.data.length + size);
    }
  }
  append(expr, size, isBranch) {
    const { chunk } = this;
    if (this.opts.refExtractor?.ref && chunk.org != null) {
      const orig = this._exprMap?.get(expr) || expr;
      if (symbols(orig).length > 0) {
        const addr = chunk.org + chunk.data.length;
        this.opts.refExtractor.ref(orig, size, addr, chunk.segments, this.orgToOffset(addr));
      }
    }
    expr = this.resolve(expr);
    const val = expr.num;
    if (expr.op !== "num" || expr.meta?.rel) {
      const offset = chunk.data.length;
      const sub = { offset, size, expr };
      if (this.opts.forceRange)
        sub.forceRange = true;
      (chunk.subs || (chunk.subs = [])).push(sub);
      this.writeNumber(chunk.data, size);
    } else {
      this.writeNumber(chunk.data, size, val, isBranch);
    }
  }
  assignPc(addr) {
    this._pcShift = { base: addr, at: this._chunk?.data.length ?? 0 };
  }
  org(addr, name) {
    this._pcShift = undefined;
    if (this._org != null && this._chunk != null && this._org + this._chunk.data.length === addr) {
      return;
    }
    this.flushPendingAlign();
    this._org = addr;
    this.clearChunk();
    this._name = name;
  }
  reloc(name) {
    this.flushPendingAlign();
    this._org = undefined;
    this._pcShift = undefined;
    this.clearChunk();
    this._name = name;
  }
  setSegmentMode(mode, at) {
    if (this._segmentMode && this._segmentMode !== mode) {
      this.fail(mode === "anon" ? `Cannot use an anonymous .segment after a named .segment; ` + `a module uses one style or the other` : `Cannot use a named .segment after an anonymous .segment; ` + `a module uses one style or the other`, at);
    }
    this._segmentMode = mode;
  }
  segment(...segments) {
    this.segmentInternal(segments);
  }
  segmentInternal(segments) {
    for (const s of segments) {
      this.setSegmentMode(Segment.isAnon(s) ? "anon" : "named");
    }
    this.flushPendingAlign();
    this.saveSegmentOrg();
    this.segments = segments.map((s) => typeof s === "string" ? s : s.name);
    for (const s of segments) {
      const name = typeof s === "string" ? s : s.name;
      let data = this.segmentData.get(name);
      if (!data) {
        const predeclared = PREDECLARED_SEGMENTS.get(name);
        if (predeclared)
          this.segmentData.set(name, data = { ...predeclared });
      }
      if (typeof s === "object") {
        this.segmentData.set(name, Segment.merge(data || { name }, s));
      }
    }
    this.clearChunk();
    this._name = undefined;
    this._org = this.segmentOrg.get(this.segmentKey());
    const shift = this.segmentShift.get(this.segmentKey());
    this._pcShift = shift == null ? undefined : { base: shift, at: 0 };
    if (this._org == null && segments.length === 1 && typeof segments[0] === "object" && Segment.isAnon(segments[0]) && segments[0].memory != null) {
      this._org = segments[0].memory;
    }
  }
  segmentKey() {
    return this.segments.join("\x00");
  }
  saveSegmentOrg() {
    const key = this.segmentKey();
    const shift = this.shiftedPc();
    if (shift == null) {
      this.segmentShift.delete(key);
    } else {
      this.segmentShift.set(key, shift);
    }
    if (this._org == null) {
      this.segmentOrg.delete(key);
      return;
    }
    this.segmentOrg.set(key, this.orgPc());
  }
  orgPc() {
    return (this._chunk?.org ?? this._org) + (this._chunk?.data.length ?? 0);
  }
  assert(expr, action = "error", message) {
    this.linter?.assert();
    this.pendingAsserts.push({
      expr: this.resolve(expr),
      action,
      message,
      chunk: this._chunk,
      source: expr.source ?? this._source,
      pc: this.shiftedPc() ?? ((this._chunk?.org ?? this._org) != null ? this.orgPc() : undefined)
    });
  }
  checkAssertions() {
    for (const a of this.pendingAsserts) {
      const linkTimeOnly = a.action === "ldwarning" || a.action === "lderror";
      const val = linkTimeOnly ? undefined : this.evaluate(a.expr);
      if (val != null) {
        if (val)
          continue;
        const pc = a.pc != null ? ` (PC=$${a.pc.toString(16)})` : "";
        const level = a.action === "warning" ? "warning" : "error";
        this.errorCollector.add(level, `${a.message ?? "Assertion failed"}${pc}`, a.source);
        continue;
      }
      const chunk = a.chunk ?? this.chunk;
      const assertion = { expr: a.expr, action: a.action };
      if (a.message != null)
        assertion.message = a.message;
      if (a.pc != null)
        assertion.pc = a.pc;
      (chunk.asserts || (chunk.asserts = [])).push(assertion);
    }
    this.pendingAsserts = [];
  }
  byte(...args) {
    this.byteInternal(args);
  }
  asciiz(...args) {
    this.asciizInternal(args);
  }
  asciizInternal(args) {
    args.push(0);
    this.byteInternal(args);
  }
  beginStruct(tokens, kind) {
    const name = this.parseOptionalIdentifier(tokens);
    if (name != null) {
      this.enterScope(name, "scope", tokens[0].source);
      this.currentScope.dbgType = kind;
    }
    this.structContext.push({ kind, offset: 0, name: name ?? undefined, count: 0 });
  }
  endStruct(kind, at) {
    const ctx = this.structContext.pop();
    if (!ctx || ctx.kind !== kind)
      this.fail(`.end${kind} without a matching .${kind}`);
    if (ctx.name != null) {
      const num = ctx.kind === "enum" ? ctx.count : ctx.offset;
      const size2 = { op: "num", num, meta: size(num) };
      this.defineSizeOfScope(this.currentScope, ctx.name, size2);
      this.exitScope("scope", at);
    }
  }
  structMember(tokens) {
    const ctx = this.structContext[this.structContext.length - 1];
    const name = str(tokens[0]);
    if (ctx.kind === "enum") {
      expectEol(tokens[1]);
      this.enumMember(name, ctx.offset, tokens[0]);
      return;
    }
    this.assign(name, ctx.offset, false, tokens[0], "structMember");
    const size = this.structMemberSize(tokens);
    this.defineSizeOfSymbol(this.currentScope, name, size);
    ctx.offset += size;
  }
  enumMember(name, value, token) {
    const ctx = this.structContext[this.structContext.length - 1];
    this.assign(name, value, false, token, "enumMember");
    this.defineSizeOfSymbol(this.currentScope, name, 1);
    this.dbg?.markUnsized(this.currentScope.symbols.get(name));
    ctx.offset = value + 1;
    ctx.count++;
  }
  structMemberSize(tokens) {
    const typeTok = tokens[1];
    if (!typeTok || typeTok.token !== "cs") {
      this.fail(`struct member '${str(tokens[0])}' needs a storage type`, tokens[0]);
    }
    const t = str(typeTok);
    if (t === ".tag") {
      const structName = expectIdentifier(tokens[2]);
      const expr = this.sizeOf(structName);
      const sz = expr != null ? this.evaluate(expr) : undefined;
      if (sz == null)
        this.fail(`.tag references unknown struct: ${structName}`, tokens[2]);
      return sz;
    }
    let unit;
    switch (t) {
      case ".byte":
      case ".res":
        unit = 1;
        break;
      case ".word":
      case ".dbyt":
        unit = 2;
        break;
      case ".faraddr":
        unit = 3;
        break;
      case ".dword":
        unit = 4;
        break;
      default:
        this.fail(`Unsupported struct member type: ${t}`, typeTok);
    }
    if (tokens.length > 2)
      return unit * this.parseConst(tokens, 2);
    if (t === ".res")
      this.fail(`.res in a struct needs a count`, typeTok);
    return unit;
  }
  alignDir(tokens) {
    const args = parseArgList(tokens, 1);
    if (args.length < 1 || args.length > 2)
      this.fail(`.align expects a boundary and optional fill`, tokens[0]);
    const boundary = this.parseConst(args[0], 0);
    const fill = args.length > 1 ? this.parseConst(args[1], 0) : undefined;
    this.align(boundary, fill);
  }
  align(boundary, fill) {
    if (boundary < 1)
      this.fail(`.align boundary must be positive: ${boundary}`);
    if ((boundary & boundary - 1) !== 0)
      this.fail(`.align boundary must be a power of two: ${boundary}`);
    if (boundary === 1)
      return;
    const shifted = this.shiftedPc();
    if (shifted != null) {
      const pad = (boundary - shifted % boundary) % boundary;
      if (pad)
        this.res(pad, fill);
      return;
    }
    if (this._org != null) {
      const pad = (boundary - this.orgPc() % boundary) % boundary;
      if (pad)
        this.res(pad, fill);
      return;
    }
    if (this._pendingAlign == null)
      this._alignChunk = this._chunk;
    this._pendingAlign = Math.max(this._pendingAlign ?? 1, boundary);
    this._pendingFill = fill ?? this._pendingFill;
    this.clearChunk();
  }
  flushPendingAlign() {
    const boundary = this._pendingAlign;
    const fill = this._pendingFill;
    const chunk = this._alignChunk;
    this._pendingAlign = undefined;
    this._pendingFill = undefined;
    this._alignChunk = undefined;
    if (boundary == null || !chunk?.data.length)
      return;
    const pc = chunk.org != null ? chunk.org + chunk.data.length : chunk.data.length;
    const pad = (boundary - pc % boundary) % boundary;
    if (chunk.org == null)
      chunk.align = Math.max(chunk.align ?? 1, boundary);
    for (let i = 0;i < pad; i++)
      chunk.data.push(fill ?? 0);
  }
  charmap(tokens) {
    const args = parseArgList(tokens, 1);
    if (args.length !== 2)
      this.fail(`.charmap expects an index and a value`, tokens[0]);
    const code = this.parseConst(args[0], 0);
    const target = this.parseConst(args[1], 0);
    this.charMap(code, target);
  }
  charMap(code, target) {
    this.chars.set(code, target);
  }
  pushCharmap() {
    this.chars.push();
  }
  popCharmap() {
    this.chars.pop();
  }
  strmap(tokens) {
    const keyTok = tokens[1];
    if (!keyTok || keyTok.token !== "str")
      this.fail(`.strmap expects a string key`, tokens[0]);
    const key = keyTok.str;
    if (!key)
      this.fail(`.strmap key must not be empty`, keyTok);
    const commaIdx = find(tokens, COMMA, 2);
    if (commaIdx < 0)
      this.fail(`.strmap expects a value after the key`, tokens[0]);
    const valueToks = tokens.slice(commaIdx + 1);
    if (!valueToks.length)
      this.fail(`.strmap expects a value after the key`, tokens[tokens.length - 1]);
    let bytes;
    if (eq(valueToks[0], LB)) {
      if (!eq(valueToks[valueToks.length - 1], RB)) {
        this.fail(`.strmap value list must end with ]`, valueToks[valueToks.length - 1]);
      }
      const inner = valueToks.slice(1, -1);
      bytes = inner.length ? parseArgList(inner, 0).map((ts) => this.parseConst(ts, 0)) : [];
      if (!bytes.length)
        this.fail(`.strmap value list must not be empty`, valueToks[0]);
    } else if (valueToks.length === 1 && valueToks[0].token === "str" && !valueToks[0].char) {
      bytes = [];
      writeString(bytes, valueToks[0].str, this.chars.mapping);
      if (!bytes.length)
        this.fail(`.strmap value must not be empty`, valueToks[0]);
    } else {
      bytes = [this.parseConst(valueToks, 0)];
    }
    this.strMap(key, bytes);
  }
  strMap(key, bytes) {
    this.chars.strMap(key, bytes);
  }
  byteInternal(args, charmap = this.chars.mapping) {
    const { chunk } = this;
    this.markWritten(args.length);
    for (const arg of args) {
      if (typeof arg === "number") {
        this.writeNumber(chunk.data, 1, arg);
      } else if (typeof arg === "string") {
        writeString(chunk.data, arg, charmap);
      } else {
        this.append(arg, 1);
      }
    }
  }
  res(count, value) {
    if (!count)
      return;
    this.byteInternal(new Array(count).fill(value ?? 0));
  }
  word(...args) {
    this.wordInternal(args);
  }
  wordInternal(args) {
    const { chunk } = this;
    this.markWritten(2 * args.length);
    for (const arg of args) {
      if (typeof arg === "number") {
        this.writeNumber(chunk.data, 2, arg);
      } else {
        this.append(arg, 2);
      }
    }
  }
  faraddr(...args) {
    this.faraddrInternal(args);
  }
  faraddrInternal(args) {
    const { chunk } = this;
    this.markWritten(3 * args.length);
    for (const arg of args) {
      if (typeof arg === "number") {
        this.writeNumber(chunk.data, 3, arg);
      } else {
        this.append(arg, 3);
      }
    }
  }
  dbyte(...args) {
    this.dbyteInternal(args);
  }
  dbyteInternal(args) {
    const { chunk } = this;
    this.markWritten(2 * args.length);
    for (const arg of args) {
      if (typeof arg === "number") {
        this.writeNumber(chunk.data, 1, arg >> 8);
        this.writeNumber(chunk.data, 1, arg);
      } else {
        this.append(this.mapRef(arg, hiByte(arg), hiByte), 1);
        this.append(this.mapRef(arg, loByte(arg), loByte), 1);
      }
    }
  }
  dword(...args) {
    this.dwordInternal(args);
  }
  dwordInternal(args) {
    const { chunk } = this;
    this.markWritten(4 * args.length);
    for (const arg of args) {
      if (typeof arg === "number") {
        this.writeNumber(chunk.data, 4, arg);
      } else {
        this.append(arg, 4);
      }
    }
  }
  free(size) {
    if (this._org == null)
      this.fail(`.free in .reloc mode`);
    this.markWritten(size);
    const segments = this.segments.length > 1 ? this.segments.filter((s) => {
      const data = this.segmentData.get(s);
      if (!data || data.memory == null || data.size == null)
        return false;
      if (data.memory > this._org)
        return false;
      if (data.memory + data.size <= this._org)
        return false;
      return true;
    }) : this.segments;
    if (segments.length !== 1) {
      this.fail(`.free with non-unique segment: ${this.segments}`);
    } else if (size < 0) {
      this.fail(`.free with negative size: ${size}`);
    }
    if (this._chunk) {
      this._org += this._chunk.data.length;
    }
    this.clearChunk();
    const name = segments[0];
    let s = this.segmentData.get(name);
    if (!s)
      this.segmentData.set(name, s = { name });
    (s.free || (s.free = [])).push([this._org, this._org + size]);
    this._org += size;
    if (this._pcShift)
      this._pcShift = { base: this._pcShift.base + size, at: 0 };
  }
  jsAction(tokens) {
    const index = this.parseConst(tokens, 1);
    const actions = this.opts.jsActions?.run(index, {
      symbol: (name) => {
        const sym = this.lookupSymbol(name);
        return sym?.expr ? this.evaluate(sym.expr) : undefined;
      }
    });
    if (!actions)
      this.fail(`No JS action list at index ${index}`, tokens[0]);
    const saved = this._source;
    runActions(this, actions);
    this.setSource(saved);
  }
  segmentPrefix(prefix) {
    this.segParser.setPrefix(prefix);
  }
  isZeropageRef(name) {
    if (this.globals.isZeropage(name))
      return true;
    const zp = Boolean(this.lookupSymbol(name)?.expr?.meta?.zeropage);
    if (!zp && this.globals.isImportRef(name)) {
      const answer = this.linkEnv?.addrSize(name);
      if (answer != null)
        return answer === 1;
      this.lateAssemblyQueries.push({ name, guess: 2, source: this._source });
    }
    return zp;
  }
  lookupSymbol(name) {
    if (name.charCodeAt(0) === 64) {
      return this.cheapLocals.symbols.get(name);
    }
    if (name.indexOf(":") < 0 || !name.includes("::")) {
      for (let scope = this.currentScope;scope; scope = scope.parent) {
        const sym = scope.symbols.get(name);
        if (sym?.expr)
          return sym;
        if (sym?.scoped)
          return sym;
      }
      return;
    }
    return this.currentScope.resolve(name, { allowForwardRef: false, missingScope: "undefined" });
  }
  declareGlobal(ident, kind, weak = false) {
    if (!this.globals.declare(ident, kind, this.currentScope, weak))
      return;
    this.dbg?.declareGlobal(ident, kind, this._source);
  }
  import(...idents) {
    this.importInternal(idents);
  }
  importInternal(idents) {
    for (const ident of idents)
      this.declareGlobal(ident, "import");
  }
  export(...idents) {
    this.exportInternal(idents);
  }
  exportInternal(idents) {
    for (const ident of idents)
      this.declareGlobal(ident, "export");
  }
  importzp(...idents) {
    this.importzpInternal(idents);
  }
  importzpInternal(idents) {
    for (const ident of idents) {
      this.declareGlobal(ident, "import");
      this.globals.markZeropage(ident);
    }
  }
  exportzp(...idents) {
    this.exportzpInternal(idents);
  }
  exportzpInternal(idents) {
    for (const ident of idents) {
      this.declareGlobal(ident, "export");
      this.globals.markZeropage(ident);
    }
  }
  global(...idents) {
    this.globalInternal(idents);
  }
  globalInternal(idents) {
    for (const ident of idents)
      this.declareGlobal(ident, "global", true);
  }
  globalzp(...idents) {
    this.globalzpInternal(idents);
  }
  globalzpInternal(idents) {
    for (const ident of idents) {
      this.declareGlobal(ident, "global", true);
      this.globals.markZeropage(ident);
    }
  }
  scope(name, at) {
    this.enterScope(name, "scope", at);
  }
  proc(name, at) {
    this.label(name);
    if (this.dbg && at) {
      const label = this.currentScope.symbols.get(name);
      if (label && !label.def)
        label.def = at;
    }
    this.enterScope(name, "proc", at);
    this.linter?.enterProc(name);
    this.currentScope.label = name;
  }
  enterScope(name, kind, at) {
    const existing = name ? this.currentScope.children.get(name) : undefined;
    if (existing) {
      if (existing.forwardDeclared) {
        existing.forwardDeclared = undefined;
        existing.kind = kind;
        existing.startPc = this.chunkPc();
        this.currentScope = existing;
        this.opts.symbolIndex?.enterScope(name, kind, at);
        return;
      }
      if (this.opts.reentrantScopes) {
        this.currentScope = existing;
        this.opts.symbolIndex?.enterScope(name, kind, at);
        return;
      }
      this.fail(`Cannot re-enter scope ${name}`);
    }
    const child = new Scope(this.currentScope, kind);
    child.startPc = this.chunkPc();
    if (this.dbg && !name)
      child.anonId = this.dbg.nextAnonScope();
    if (name) {
      child.name = name;
      this.currentScope.children.set(name, child);
    } else {
      this.currentScope.anonymousChildren.push(child);
    }
    this.currentScope = child;
    this.opts.symbolIndex?.enterScope(name, kind, at);
  }
  endScope(at) {
    this.exitScope("scope", at);
  }
  endProc(at) {
    this.exitScope("proc", at);
  }
  exitScope(kind, at) {
    if (this.currentScope.kind !== kind || !this.currentScope.parent) {
      this.fail(`.end${kind} without .${kind}`);
    }
    if (kind === "proc")
      this.linter?.exitProc(at);
    const scope = this.currentScope;
    const end = at ?? this._source;
    if (end && scope.dbgType !== "enum")
      this.dbg?.tables.lineId(end);
    if (scope.startPc && !scope.symbols.has(SIZE_NAME)) {
      this.defineSizeOfScope(scope, scope.label, this.sizeSpan(scope.startPc, this.chunkPc()));
    }
    this.currentScope = scope.parent;
    this.opts.symbolIndex?.exitScope(at);
  }
  pushSeg(...segments) {
    this.pushSegInternal(segments);
  }
  pushSegInternal(segments) {
    this.preventInvalidAnonSegChange(".pushseg");
    this.flushPendingAlign();
    this.segmentStack.push([this.segments, this._chunk, this._chunkIndex, this._org, this._pcShift]);
    if (segments.length) {
      this.segmentInternal(segments);
    }
  }
  popSeg() {
    this.preventInvalidAnonSegChange(".popseg");
    if (!this.segmentStack.length)
      this.fail(`.popseg without .pushseg`);
    this.flushPendingAlign();
    this.saveSegmentOrg();
    let org;
    [this.segments, this._chunk, this._chunkIndex, org, this._pcShift] = this.segmentStack.pop();
    this._org = this._chunk?.org ?? org;
  }
  preventInvalidAnonSegChange(directive) {
    if (this._segmentMode === "anon") {
      this.fail(`${directive} cannot be used with anonymous segments; ` + `they are sequential file positions, not a stack`);
    }
  }
  setCpu(name) {
    if (!SUPPORTED_CPUS.has(name.toLowerCase())) {
      this.fail(`Unsupported CPU: ${name}`);
    }
  }
  pushCpu() {
    this.cpuStack.push(DEFAULT_CPU_NAME);
  }
  popCpu() {
    if (!this.cpuStack.length)
      this.fail(`.popcpu without .pushcpu`);
    this.cpuStack.pop();
  }
  feature(tokens) {
    if (tokens.length < 2)
      this.fail(`Expected feature name(s)`, tokens[0]);
    const tokOpts = this.opts.tokenizerOptions ?? {};
    for (const term of parseArgList(tokens, 1)) {
      const nameTok = term[0];
      const name = expectIdentifier(nameTok, tokens[0]);
      const on = this.parseFeatureState(term, nameTok);
      try {
        applyFeature(name, this.opts, tokOpts, on);
      } catch (err) {
        if (err instanceof RecoverableError) {
          this.errorCollector.add("warning", err.message, this._source);
          continue;
        }
        if (err instanceof UnknownFeatureError) {
          this.fail(`Unknown feature: ${err.message}`, nameTok);
        }
        if (err instanceof UnsupportedFeatureError) {
          this.fail(`Unsupported feature: ${err.message}`, nameTok);
        }
        throw err;
      }
    }
  }
  parseFeatureState(term, nameTok) {
    if (term.length === 1)
      return true;
    const tok = term[1];
    if (term.length === 2) {
      if (tok.token === "ident") {
        const state = str(tok).toLowerCase();
        if (state === "on")
          return true;
        if (state === "off")
          return false;
      }
      if (tok.token === "op") {
        if (tok.str === "+")
          return true;
        if (tok.str === "-")
          return false;
      }
    }
    this.fail(`Expected on, off, + or - after feature name`, tok ?? nameTok);
  }
  dbgDirective(tokens) {
    const args = parseArgList(tokens, 1);
    const key = expectIdentifier(args[0][0], tokens[0]).toLowerCase();
    expectEol(args[0][1]);
    const want = (n) => {
      if (args.length !== n)
        this.fail(`Expected ${n - 1} arguments after .dbg ${key}`, tokens[0]);
    };
    const str2 = (i) => {
      const out = expectString(args[i][0], tokens[0]);
      expectEol(args[i][1]);
      return out;
    };
    const storage = (i, classes) => {
      const tok = args[i][0];
      const sc = tok?.token === "ident" && args[i].length === 1 ? classes.get(str(tok).toLowerCase()) : undefined;
      if (!sc)
        this.fail(`Storage class specifier expected`, tok ?? tokens[0]);
      return sc;
    };
    const type = (i) => {
      const hex = str2(i);
      if (hex.length < 2 || hex.length & 1)
        this.fail(`Type value has invalid length`, args[i][0]);
      if (!/^[0-9a-f]*$/i.test(hex))
        this.fail(`Type value contains invalid characters`, args[i][0]);
      return hex.toUpperCase();
    };
    const source = tokens[0].source;
    switch (key) {
      case "file": {
        want(4);
        const name = str2(1);
        const size = this.parseConst(args[2], 0);
        const mtime = this.parseConst(args[3], 0);
        this.dbg?.tables.declareFile(name, size, mtime);
        return;
      }
      case "line": {
        if (this.dbg)
          this.dbg.tables.ext = undefined;
        if (args.length === 1)
          return;
        want(3);
        const file = str2(1);
        const line = this.parseConst(args[2], 0);
        if (line < 0)
          this.fail(`Line number is out of valid range`, args[2][0]);
        if (!this.dbg)
          return;
        if (!this.dbg.tables.hasFile(file))
          this.fail(`File name '${file}' not found in file table`, args[1][0]);
        this.dbg.tables.ext = { file, line };
        return;
      }
      case "func": {
        want(5);
        const csym = {
          name: str2(1),
          type: type(2),
          sc: storage(3, FUNC_CLASSES),
          scope: this.currentScope,
          asmName: str2(4),
          func: true,
          source
        };
        const scope = this.currentScope;
        if (scope === scope.global) {
          this.fail(`Functions may not be used in the root scope`, tokens[0]);
        }
        if (scope.kind !== "proc" || !scope.label) {
          this.fail(`Functions can only be tagged to .PROC scopes`, tokens[0]);
        }
        if (this.dbg?.hasFunc(scope)) {
          this.fail(`Only one HLL symbol per asm symbol is allowed`, tokens[0]);
        }
        if (scope.label !== csym.asmName) {
          this.fail(`Scope label and asm name for function must match`, args[4][0]);
        }
        this.dbg?.addCSym(csym);
        return;
      }
      case "sym": {
        if (args.length < 5)
          want(5);
        const csym = {
          name: str2(1),
          type: type(2),
          sc: storage(3, SYM_CLASSES),
          scope: this.currentScope,
          source
        };
        if (csym.sc === "auto") {
          want(5);
          csym.offs = this.parseConst(args[4], 0);
        } else {
          want(csym.sc === "reg" ? 6 : 5);
          csym.asmName = str2(4);
          if (csym.sc === "reg")
            csym.offs = this.parseConst(args[5], 0);
        }
        this.dbg?.addCSym(csym);
        return;
      }
    }
    this.fail(`Unknown .dbg kind: ${key}`, args[0][0]);
  }
  move(size, source) {
    this.append({ op: ".move", args: [source], meta: { size } }, size);
  }
  autoimport(tokens) {
    this.globals.autoimportEnabled = this.parseBoolOption(tokens);
  }
  parseBoolOption(tokens) {
    const tok = tokens[1];
    if (!tok)
      return true;
    expectEol(tokens[2]);
    const state = str(tok).toLowerCase();
    if (tok.token === "ident" && (state === "on" || state === "off"))
      return state === "on";
    if (tok.token === "op" && (state === "+" || state === "-"))
      return state === "+";
    this.fail(`'on' or 'off' expected`, tok);
  }
  log(level, line, fatal = false) {
    const str = expectString(line[1], line[0]);
    expectEol(line[2], "a single string");
    const source = line[0].source;
    if (fatal)
      throw new FatalError(str, source);
    const errorLevel = level === "warn" ? "warning" : level;
    this.errorCollector.add(errorLevel, str, source);
    if (level === "error") {
      throw new RecoverableError(str, source);
    }
  }
  parseConst(tokens, start) {
    const val = this.evaluate(this.parseExpr(tokens, start));
    if (val != null)
      return val;
    this.fail(`Expression is not constant`, tokens[1]);
  }
  parseNoArgs(tokens, _start) {
    expectEol(tokens[1]);
  }
  parseExpr(tokens, start) {
    const expr = parseOnly(tokens, start, this.symbolLookup, this.encodeChar);
    if (!this.opts.refExtractor?.ref)
      return expr;
    const out = { ...expr };
    this.exprMap.set(out, parseOnly(tokens, start, NO_INLINE_LOOKUP, this.encodeChar));
    return out;
  }
  mapRef(expr, wrapped, wrap) {
    const orig = this._exprMap?.get(expr);
    if (orig) {
      this.exprMap.set(wrapped, wrap(orig));
    }
    return wrapped;
  }
  encodeChar = this.chars.encodeChar;
  parseStr(tokens, start) {
    const str = expectString(tokens[start]);
    expectEol(tokens[start + 1], "a single string");
    return str;
  }
  parseOptionalStr(tokens, start) {
    const tok = tokens[start];
    if (!tok)
      return;
    if (tok.token === "str")
      return tok.str;
    return;
  }
  parseFlag(tokens, key) {
    return this.segParser.parseFlag(tokens, key);
  }
  parseAlign(tokens, key) {
    return this.segParser.parseAlign(tokens, key);
  }
  parseSegmentList(tokens, start, allowEmptySegmentList) {
    return this.segParser.parseSegmentList(tokens, start, allowEmptySegmentList);
  }
  parseSegmentNameList(val, key, at) {
    return this.segParser.parseSegmentNameList(val, key, at);
  }
  parseAnonSegment(ts, argCount) {
    return this.segParser.parseAnonSegment(ts, argCount);
  }
  parseShorthandMirroredSegment(ts) {
    return this.segParser.parseShorthandMirroredSegment(ts);
  }
  parseResArgs(tokens) {
    const data = this.parseDataList(tokens);
    if (data.length > 2)
      this.fail(`Expected at most 2 args`, data[2]);
    if (!data.length)
      this.fail(`Expected at least 1 arg`);
    const count = this.evaluate(data[0]);
    if (count == null)
      this.fail(`Expected constant count`);
    const val = data[1] && this.evaluate(data[1]);
    if (data[1] && val == null)
      this.fail(`Expected constant value`);
    return [count, val];
  }
  parseDataList(tokens, allowString = false) {
    if (tokens.length < 2) {
      this.fail(`Expected a data list`, tokens[0]);
    }
    const out = [];
    for (const term of parseArgList(tokens, 1)) {
      if (allowString && term.length === 1 && term[0].token === "str") {
        out.push(term[0].str);
      } else if (term.length < 1) {
        this.fail(`Missing term`);
      } else {
        out.push(this.resolve(this.parseExpr(term, 0)));
      }
    }
    return out;
  }
  parseIdentifierList(tokens) {
    if (tokens.length < 2) {
      this.fail(`Expected identifier(s)`, tokens[0]);
    }
    const out = [];
    for (const term of parseArgList(tokens, 1)) {
      if (term.length !== 1 || term[0].token !== "ident") {
        this.fail(`Expected identifier: ${name(term[0])}`, term[0]);
      }
      out.push(str(term[0]));
    }
    return out;
  }
  parseOptionalIdentifier(tokens) {
    const tok = tokens[1];
    if (!tok)
      return;
    const ident = expectIdentifier(tok);
    expectEol(tokens[2]);
    return ident;
  }
  parseRequiredIdentifier(tokens) {
    const ident = expectIdentifier(tokens[1]);
    expectEol(tokens[2]);
    return ident;
  }
  parseProcName(tokens) {
    const ident = expectIdentifier(tokens[1]);
    if (eq(tokens[2], COLON)) {
      const size = tokens[3]?.token === "ident" ? str(tokens[3]).toLowerCase() : "";
      if (!ADDR_SIZE_KEYWORDS.has(size))
        this.fail(`Address size specifier expected`, tokens[3] ?? tokens[2]);
      expectEol(tokens[4]);
    } else {
      expectEol(tokens[2]);
    }
    return ident;
  }
  parseMoveArgs(tokens) {
    const args = parseArgList(tokens, 1);
    if (args.length !== 2) {
      this.fail(`Expected constant number, then identifier`);
    }
    const num = this.evaluate(this.parseExpr(args[0], 0));
    if (num == null)
      this.fail(`Expected a constant number`);
    const offset = this.resolve(this.parseExpr(args[1], 0));
    if (offset.op === "num" && offset.meta?.chunk != null) {
      return [num, offset];
    } else {
      this.fail(`Expected a constant offset`, args[1][0]);
    }
  }
  parseByteStr(tokens) {
    const bytestr = expectString(tokens[1]);
    expectEol(tokens[2]);
    const buf = new Base64().decode(bytestr);
    return Array.from(new Uint8Array(buf));
  }
  parseAssert(tokens) {
    const args = parseArgList(tokens, 1);
    if (!args[0]) {
      this.fail(`No assertion expression provided`);
    }
    const expr = this.parseExpr(args[0], 0);
    let next = 1;
    let action = "error";
    const actionTok = args.at(next)?.at(0);
    if (actionTok?.token === "ident") {
      const found = ASSERT_ACTIONS.get(actionTok.str.toLowerCase());
      if (!found) {
        this.fail(`Bad assertion action: ${actionTok.str}
` + `Expected one of warning, error, ldwarning, lderror`, actionTok);
      }
      action = found;
      next++;
    }
    let message;
    const messageArg = args.at(next);
    if (messageArg?.length) {
      const tok = messageArg[0];
      if (messageArg.length > 1 || tok.token !== "str") {
        this.fail(`Expected a constant string message`, tok);
      }
      message = tok.str;
      next++;
    }
    const extra = args.at(next);
    if (extra?.length)
      this.fail(`Too many arguments to .assert`, extra[0]);
    return [expr, action, message];
  }
  getMessages() {
    return this.errorCollector.getMessages();
  }
  hasErrors() {
    return this.errorCollector.hasErrors();
  }
  fail(msg, at) {
    if (!at && this.errorToken)
      at = this.errorToken;
    const source = at?.source ?? this._source;
    this.errorCollector.add("error", msg, source);
    const fullMsg = !source && !this._source && this._chunk?.name ? `${msg}
  in ${this._chunk.name}` : msg;
    throw new RecoverableError(fullMsg, source);
  }
  writeNumber(data, size, val, isBranch) {
    if (val != null && !this.opts.forceRange && !fits(val, size, isBranch)) {
      this.errorCollector.add("error", rangeErrorMessage(val, size, isBranch), this._source);
    }
    for (let i = 0;i < size; i++) {
      data.push(val != null ? val & 255 : 255);
      if (val != null)
        val >>= 8;
    }
  }
  orgToOffset(org) {
    const segment = this.segmentData.get(this.segments.find((s) => {
      const data = this.segmentData.get(s);
      return data && Segment.includesOrg(data, org);
    }));
    return segment?.offset != null ? segment.offset + (org - segment.memory) : undefined;
  }
  isWritten(offset) {
    return this.written.has(offset);
  }
}
var ADDR_SIZE_KEYWORDS = new Set([
  "direct",
  "zeropage",
  "zp",
  "absolute",
  "abs",
  "near",
  "far",
  "long",
  "dword"
]);
var ADDR_SIZE_NAMES = { z: "direct", a: "absolute", f: "far" };
var ForceDirectAddressingMap = new Map([
  ["add", "zpg"],
  ["a,x", "zpx"],
  ["a,y", "zpy"],
  ["abs", "zpg"],
  ["abx", "zpx"],
  ["aby", "zpy"]
]);
var ForceAbsoluteAddressingMap = new Map([
  ["add", "abs"],
  ["a,x", "abx"],
  ["a,y", "aby"],
  ["zpg", "abs"],
  ["zpx", "abx"],
  ["zpy", "aby"]
]);

// src/linkerconfig.ts
var AREA_TYPES = ["ro", "rw"];
var SEGMENT_TYPES = ["ro", "rw", "bss", "zp", "overwrite"];
var RE_CFG_COMMENT = /(#|\/\/).*/y;
var RE_CFG_OPERATOR = /([;,=:]|\++|-+|&&?|\|\|?|[*/~^]|<[<=]?|>[>=]?)/y;
var RE_CFG_PERCENT = /%[a-z0-9_]*/iy;

class CfgTokenizer extends Tokenizer {
  startAddr;
  skipIgnored() {
    while (this.buffer.space() || this.buffer.newline() || this.buffer.token(RE_CFG_COMMENT)) {}
  }
  matchNumber() {
    const buf = this.buffer;
    if (buf.content.charCodeAt(buf.pos) === 37)
      return;
    return super.matchNumber();
  }
  matchOperator() {
    return this.buffer.token(RE_CFG_OPERATOR) ? this.strTok("op") : undefined;
  }
  matchAddrSize() {
    return;
  }
  isRegister() {
    return false;
  }
  tokenOther(c) {
    if (c === 59) {
      const tok = this.matchOperator();
      if (tok)
        return tok;
    }
    if (c === 37 && this.buffer.token(RE_CFG_PERCENT)) {
      if (this.buffer.group() === "%S" && this.startAddr != null) {
        return numToken(this.startAddr);
      }
      return this.strTok("str");
    }
    return super.tokenOther(c);
  }
  get recoversFromTokenErrors() {
    return false;
  }
  tokens() {
    return this.nextSync() ?? [];
  }
}

class Attrs {
  at;
  values = new Map;
  keys = new Map;
  constructor(args, at) {
    this.at = at;
    for (const arg of args) {
      const keyTok = arg[0];
      const key = expectIdentifier(keyTok, at).toLowerCase();
      expect(ASSIGN, arg[1], keyTok);
      const value = arg.slice(2);
      if (!value.length)
        fail(`Missing value for '${key}'`, arg[1]);
      if (this.values.has(key))
        fail(`Duplicate attribute: ${key}`, keyTok);
      this.values.set(key, value);
      this.keys.set(key, keyTok);
    }
  }
  checkKnown(known, block) {
    for (const key of this.values.keys()) {
      if (known.includes(key))
        continue;
      fail(`Unknown ${block} attribute '${key}', expected one of: ${known.join(", ")}`, this.keys.get(key));
    }
  }
  checkForbidden(forbidden, because) {
    for (const key of forbidden) {
      if (!this.values.has(key))
        continue;
      fail(`'${key}' cannot be combined with '${because}'`, this.keys.get(key));
    }
  }
  expr(key) {
    const value = this.values.get(key);
    if (!value)
      return;
    try {
      return traversePost(parseOnly(value), evaluate);
    } catch (err) {
      throw SourceError.locate(err, value[0].source);
    }
  }
  reqExpr(key) {
    const expr = this.expr(key);
    if (!expr)
      fail(`Missing required attribute '${key}'`, this.at);
    return expr;
  }
  num(key) {
    const expr = this.expr(key);
    if (!expr)
      return;
    if (expr.op !== "num" || expr.num == null) {
      fail(`Value of '${key}' must be a constant${describeUnresolved(expr)}`, this.values.get(key)[0]);
    }
    return expr.num;
  }
  reqNum(key) {
    const value = this.num(key);
    if (value == null)
      fail(`Missing required attribute '${key}'`, this.at);
    return value;
  }
  keyword(key, allowed) {
    const value = this.values.get(key);
    if (!value)
      return;
    if (value.length !== 1 || value[0].token !== "ident" || !allowed.includes(value[0].str.toLowerCase())) {
      fail(`Value of '${key}' must be one of: ${allowed.join(", ")}`, value[0]);
    }
    return value[0].str.toLowerCase();
  }
  bool(key, dflt) {
    const value = this.keyword(key, ["yes", "no", "true", "false"]);
    if (value == null)
      return dflt;
    return value === "yes" || value === "true";
  }
  name(key) {
    const value = this.values.get(key);
    if (!value)
      return;
    const tok = value[0];
    if (value.length !== 1 || tok.token !== "ident" && tok.token !== "str") {
      fail(`Value of '${key}' must be a name`, tok);
    }
    return tok.str;
  }
  reqName(key) {
    const value = this.name(key);
    if (value == null)
      fail(`Missing required attribute '${key}'`, this.at);
    return value;
  }
  nameList(key) {
    const value = this.values.get(key);
    if (!value)
      return;
    const grp = value.length === 1 && value[0].token === "grp" ? value[0] : undefined;
    if (!grp) {
      fail(`Value of '${key}' must be a braced list: ${key} = {A, B}`, value[0]);
    }
    const names = [];
    for (const tok of grp.inner) {
      if (eq(tok, COMMA))
        continue;
      if (tok.token !== "ident" && tok.token !== "str") {
        fail(`Value of '${key}' must be a list of names`, tok);
      }
      names.push(tok.str);
    }
    if (names.length < 2) {
      fail(`'${key}' needs at least two segments: ${names.length ? names.join(", ") : "(empty)"}`, this.keys.get(key));
    }
    if (new Set(names).size !== names.length) {
      fail(`'${key}' contains a duplicate segment: ${names.join(", ")}`, this.keys.get(key));
    }
    return names;
  }
}
function unresolvedNames(expr) {
  const out = new Set;
  traverse(expr, (e, rec) => {
    if (e.sym)
      out.add(e.sym);
    if (e.str)
      out.add(e.str);
    return rec(e);
  });
  return [...out];
}
function describeUnresolved(expr) {
  const names = unresolvedNames(expr);
  if (!names.length)
    return "";
  return ` (${names.join(", ")} ${names.length > 1 ? "are" : "is"} not defined)`;
}
function resolveCfgExpr(expr, symbols, what) {
  const resolved = traverse(expr, (e, rec) => {
    if (e.op === "sym" && e.sym != null) {
      const value = symbols.get(e.sym);
      if (value != null)
        return { op: "num", num: value };
    }
    return evaluate(rec(e));
  });
  if (resolved.op !== "num" || resolved.num == null) {
    fail(`${what} is not constant${describeUnresolved(resolved)}`, expr);
  }
  return resolved.num;
}
var RE_DEFINE_NUM = /^\s*(?:\$([0-9a-f]+)|%([01]+)|([0-9]+))\s*$/i;
function linkerDefines(defines) {
  const out = new Map;
  for (const { name, value } of defines ?? []) {
    const m = RE_DEFINE_NUM.exec(value);
    if (!m)
      continue;
    const [, hex, bin, dec] = m;
    out.set(name, hex != null ? parseInt(hex, 16) : bin != null ? parseInt(bin, 2) : parseInt(dec, 10));
  }
  return out;
}
function configSymbols(cfg, objectExports = new Set, defines = new Map) {
  const out = new Map;
  for (const sym of cfg.symbols) {
    if (sym.value == null)
      continue;
    if (sym.type === "weak" && objectExports.has(sym.name))
      continue;
    const define = defines.get(sym.name);
    if (define != null) {
      out.set(sym.name, define);
      continue;
    }
    try {
      out.set(sym.name, resolveCfgExpr(sym.value, out, `Value of '${sym.name}'`));
    } catch {}
  }
  return out;
}
function statements(grp, at) {
  const out = [];
  let start = 0;
  for (;; ) {
    const semi = find(grp, SEMI, start);
    if (semi < 0)
      break;
    if (semi > start)
      out.push(grp.slice(start, semi));
    start = semi + 1;
  }
  if (start < grp.length) {
    fail(`Expected ';' after statement`, grp[grp.length - 1] ?? at);
  }
  return out;
}
function splitAttrs(stmt, start) {
  const out = [];
  let cur;
  let depth = 0;
  for (let i = start;i < stmt.length; i++) {
    const tok = stmt[i];
    if (!depth && tok.token === "ident" && eq(stmt[i + 1], ASSIGN)) {
      out.push(cur = [tok]);
      continue;
    }
    if (eq(tok, LP))
      depth++;
    else if (eq(tok, RP))
      depth--;
    else if (!depth && eq(tok, COMMA))
      continue;
    if (!cur) {
      fail(`Expected an attribute name: ${nameOf(tok)}`, tok);
    }
    cur.push(tok);
  }
  return out;
}
function statementName(stmt, block, seen) {
  const tok = stmt[0];
  if (tok.token !== "ident" && tok.token !== "str") {
    fail(`Expected a name: ${nameOf(tok)}`, tok);
  }
  expect(COLON, stmt[1], tok);
  if (seen.some((s) => s.name === tok.str)) {
    fail(`Duplicate ${block} entry: ${tok.str}`, tok);
  }
  return tok.str;
}
var MEMORY_ATTRS = [
  "bank",
  "define",
  "file",
  "fill",
  "fillval",
  "size",
  "start",
  "type"
];
var SEGMENT_ATTRS = [
  "align",
  "align_load",
  "define",
  "fillval",
  "load",
  "mirror",
  "offset",
  "optional",
  "pool",
  "run",
  "start",
  "type"
];
var COMPOSITE_FORBIDDEN_ATTRS = [
  "align",
  "align_load",
  "define",
  "fillval",
  "load",
  "offset",
  "run",
  "start",
  "type"
];
function parseMemory(grp, at, out) {
  for (const stmt of statements(grp, at)) {
    const name = statementName(stmt, "MEMORY", out);
    const attrs = new Attrs(splitAttrs(stmt, 2), stmt[0]);
    attrs.checkKnown(MEMORY_ATTRS, "MEMORY");
    const file = attrs.name("file") || undefined;
    const bank = attrs.expr("bank");
    out.push({
      name,
      start: attrs.reqExpr("start"),
      size: attrs.reqExpr("size"),
      type: attrs.keyword("type", AREA_TYPES) ?? "rw",
      ...file != null ? { file } : {},
      fill: attrs.bool("fill", false),
      fillval: attrs.num("fillval") ?? 0,
      ...bank != null ? { bank } : {},
      define: attrs.bool("define", false),
      index: out.length
    });
  }
}
function parseSegments(grp, at, out) {
  for (const stmt of statements(grp, at)) {
    const name = statementName(stmt, "SEGMENTS", out);
    const attrs = new Attrs(splitAttrs(stmt, 2), stmt[0]);
    attrs.checkKnown(SEGMENT_ATTRS, "SEGMENTS");
    const mirror = attrs.nameList("mirror");
    const pool = attrs.nameList("pool");
    if (mirror && pool) {
      fail(`Segment '${name}' cannot be both a 'mirror' and a 'pool'`, stmt[0]);
    }
    if (mirror || pool) {
      const key = mirror ? "mirror" : "pool";
      attrs.checkForbidden(COMPOSITE_FORBIDDEN_ATTRS, key);
      out.push({
        name,
        ...mirror ? { mirror } : { pool },
        optional: attrs.bool("optional", false),
        define: false,
        index: out.length,
        at: stmt[0]
      });
      continue;
    }
    const load = attrs.name("load");
    const run = attrs.name("run");
    if (load == null && run == null) {
      fail(`Segment '${name}' needs at least one of 'load', 'run', ${""}'mirror' or 'pool'`, stmt[0]);
    }
    out.push({
      name,
      load: load ?? run,
      run: run ?? load,
      type: attrs.keyword("type", SEGMENT_TYPES),
      align: attrs.num("align"),
      alignLoad: attrs.num("align_load"),
      start: attrs.num("start"),
      offset: attrs.num("offset"),
      fillval: attrs.num("fillval"),
      define: attrs.bool("define", false),
      optional: attrs.bool("optional", false),
      index: out.length,
      at: stmt[0]
    });
  }
}
function parseFiles(grp, at, out) {
  for (const stmt of statements(grp, at)) {
    const name = statementName(stmt, "FILES", out);
    const attrs = new Attrs(splitAttrs(stmt, 2), stmt[0]);
    attrs.checkKnown(["format"], "FILES");
    const format = attrs.keyword("format", ["bin", "binary", "o65", "atari"]);
    out.push({ name, format: format === "binary" ? "bin" : format ?? "bin" });
  }
}
function parseSymbols(grp, at, out) {
  for (const stmt of statements(grp, at)) {
    const name = statementName(stmt, "SYMBOLS", out);
    const attrs = new Attrs(splitAttrs(stmt, 2), stmt[0]);
    attrs.checkKnown(["type", "value", "addrsize"], "SYMBOLS");
    const type = attrs.keyword("type", ["export", "import", "weak"]) ?? fail(`Symbol '${name}' needs a 'type'`, stmt[0]);
    const value = attrs.expr("value");
    if (type === "import") {
      if (value != null) {
        fail(`Imported symbol '${name}' must not have a value`, stmt[0]);
      }
    } else if (value == null) {
      fail(`Symbol '${name}' of type '${type}' needs a 'value'`, stmt[0]);
    }
    out.push({ name, type, ...value != null ? { value } : {} });
  }
}
function parseLinkerConfig(text, file = "linker.cfg", opts = {}) {
  const errors = new ErrorCollector;
  const tokenizer = new CfgTokenizer(text, file, { generateDebugInfo: true }, undefined, errors);
  tokenizer.startAddr = opts.startAddr;
  const toks = tokenizer.tokens();
  const firstError = errors.getMessages().find((m) => m.level === "error");
  if (firstError)
    throw new SourceError(firstError.message, firstError.source);
  const memory = [];
  const rawSegments = [];
  const files = [];
  const symbols = [];
  for (let i = 0;i < toks.length; i += 2) {
    const nameTok = toks[i];
    const name = expectIdentifier(nameTok, toks[i - 1]).toUpperCase();
    const grp = toks[i + 1];
    if (!grp || grp.token !== "grp") {
      fail(`Expected '{' after ${name}`, grp ?? nameTok);
    }
    switch (name) {
      case "MEMORY":
        parseMemory(grp.inner, nameTok, memory);
        break;
      case "SEGMENTS":
        parseSegments(grp.inner, nameTok, rawSegments);
        break;
      case "FILES":
        parseFiles(grp.inner, nameTok, files);
        break;
      case "SYMBOLS":
        parseSymbols(grp.inner, nameTok, symbols);
        break;
      case "FEATURES":
      case "FORMATS":
        break;
      default:
        fail(`Unknown linker config block: ${name}`, nameTok);
    }
  }
  const areas = new Map(memory.map((a) => [a.name, a]));
  const segments = rawSegments.map((raw) => {
    const { at, ...rest } = raw;
    const members = rest.mirror ?? rest.pool;
    if (members) {
      for (const member of members) {
        if (!areas.has(member)) {
          fail(`Segment '${rest.name}' lists ${member}, which is not a MEMORY area`, at);
        }
      }
      if (areas.has(rest.name)) {
        fail(`Segment '${rest.name}' shares its name with a MEMORY ${""}area. Rename one of them`, at);
      }
      return { ...rest };
    }
    for (const key of ["load", "run"]) {
      if (!areas.has(rest[key])) {
        fail(`Segment '${rest.name}' has ${key} = ${rest[key]}, which is not a MEMORY area`, at);
      }
    }
    if (areas.has(rest.name) && (rest.load !== rest.name || rest.run !== rest.name)) {
      fail(`Segment '${rest.name}' shares its name with a MEMORY area ${""}but does not load and run there. Rename one of them or use the MEMORY segment directly`, at);
    }
    const def = { ...rest, type: rest.type ?? areas.get(rest.load).type };
    if (rest.type)
      def.declaredType = rest.type;
    return def;
  });
  return { memory, segments, files, symbols };
}
function lowerLinkerConfig(cfg, objectExports = new Set, defines = new Map) {
  const symbols = configSymbols(cfg, objectExports, defines);
  const out = [];
  const areas = new Map;
  const originalSegments = new Map(cfg.segments.map((s) => [s.name, s]));
  for (const area of cfg.memory) {
    const what = `MEMORY area '${area.name}'`;
    const memory = resolveCfgExpr(area.start, symbols, `${what} start`);
    const size = resolveCfgExpr(area.size, symbols, `${what} size`);
    const seg = { name: area.name, memory, size };
    if (area.bank != null) {
      seg.bank = resolveCfgExpr(area.bank, symbols, `${what} bank`);
    }
    if (area.file != null)
      seg.out = area.file;
    if (area.fill)
      seg.fill = area.fillval;
    if (area.define)
      seg.define = true;
    const segdef = originalSegments.get(area.name);
    if (segdef) {
      const start = segdef.start ?? (segdef.offset != null ? memory + segdef.offset : undefined);
      let from = start ?? memory;
      if (segdef.align != null) {
        from = Math.ceil(from / segdef.align) * segdef.align;
      }
      if (from < memory || from >= memory + size) {
        fail2(`Segment '${segdef.name}' starts at $${from.toString(16)}, which ${""}is outside the MEMORY area of the same name ($${memory.toString(16)}..$${(memory + size).toString(16)})`);
      }
      seg.memory = from;
      seg.size = size - (from - memory);
      applySegmentType(seg, segdef);
      if (area.fill && segdef.fillval != null)
        seg.fill = segdef.fillval;
      if (segdef.define)
        seg.define = true;
    }
    areas.set(area.name, seg);
    out.push(seg);
  }
  for (const def of cfg.segments) {
    if (areas.has(def.name))
      continue;
    const members = def.mirror ?? def.pool;
    if (members) {
      const seg = {
        name: def.name,
        ...def.mirror ? { mirror: members } : { pool: members }
      };
      if (def.optional)
        seg.optional = true;
      out.push(seg);
      continue;
    }
    const seg = { name: def.name, load: def.load, run: def.run };
    const memory = def.start ?? (def.offset != null ? areas.get(def.run).memory + def.offset : undefined);
    if (memory != null)
      seg.memory = memory;
    if (def.align != null)
      seg.align = def.align;
    if (def.alignLoad != null)
      seg.alignLoad = def.alignLoad;
    if (def.fillval != null)
      seg.fill = def.fillval;
    applySegmentType(seg, def);
    if (def.define)
      seg.define = true;
    if (def.optional)
      seg.optional = true;
    out.push(seg);
  }
  return out;
}
function applySegmentType(seg, def) {
  if (def.type === "bss" || def.type === "zp")
    seg.bss = true;
  if (def.type === "zp")
    seg.addressing = 1;
}
function fail2(message) {
  throw new SourceError(message);
}

// src/lspindex.ts
class MacroIndex {
  entries = new Map;
  record(name, kind, macro, definition) {
    this.entries.set(name, { name, kind, macro, definition });
  }
  remove(name) {
    this.entries.delete(name);
  }
  get(name) {
    return this.entries.get(name);
  }
  all() {
    return this.entries.values();
  }
  adopt(other) {
    for (const [name, entry] of other.entries)
      this.entries.set(name, entry);
  }
  get size() {
    return this.entries.size;
  }
}

class SymbolIndex {
  root = {
    name: "",
    qualifiedName: "",
    kind: "scope",
    children: [],
    symbols: new Map
  };
  stack = [this.root];
  enterScope(name, kind, start) {
    const parent = this.stack[this.stack.length - 1];
    const anon = name == null;
    const simpleName = anon ? `@${parent.children.length}` : name;
    const qualifiedName = parent === this.root ? simpleName : `${parent.qualifiedName}::${simpleName}`;
    const entry = {
      name: simpleName,
      qualifiedName,
      kind,
      start,
      children: [],
      symbols: new Map
    };
    parent.children.push(entry);
    this.stack.push(entry);
  }
  exitScope(end) {
    const entry = this.stack.pop();
    if (entry && end)
      entry.end = end;
  }
  modules = new WeakMap;
  kinds = new WeakMap;
  recordSymbol(sym, name, moduleName, kind) {
    this.stack[this.stack.length - 1].symbols.set(name, sym);
    if (moduleName != null)
      this.modules.set(sym, moduleName);
    if (kind != null)
      this.kinds.set(sym, kind);
  }
  moduleOf(sym) {
    return this.modules.get(sym);
  }
  kindOf(sym) {
    const tagged = this.kinds.get(sym);
    if (tagged)
      return tagged;
    return sym.isLabel ? "label" : "constant";
  }
  *walk() {
    for (const child of this.root.children)
      yield* this.walkImpl(child);
    yield this.root;
  }
  *walkImpl(scope) {
    yield scope;
    for (const child of scope.children)
      yield* this.walkImpl(child);
  }
  findScope(qualifiedName) {
    for (const scope of this.walk()) {
      if (scope.qualifiedName === qualifiedName)
        return scope;
    }
    return;
  }
  scopeAt(file, line) {
    let best;
    for (const scope of this.walk()) {
      if (!scope.start || scope.start.file !== file)
        continue;
      if (scope.start.line > line)
        continue;
      if (scope.end && scope.end.line < line)
        continue;
      if (!best || scope.qualifiedName.length > best.qualifiedName.length)
        best = scope;
    }
    return best;
  }
  findSymbol(name) {
    for (const scope of this.walk()) {
      const sym = scope.symbols.get(name);
      if (sym)
        return { scope, sym };
    }
    return;
  }
  rootScopeFiles() {
    const files = new Set;
    for (const c of this.root.children) {
      if (c.start)
        files.add(c.start.file);
    }
    return files;
  }
  dropFiles(files) {
    this.root.children = this.root.children.filter((c) => !c.start || !files.has(c.start.file));
  }
  adopt(other) {
    this.root.children.push(...other.root.children);
    for (const [name, sym] of other.root.symbols) {
      this.root.symbols.set(name, sym);
    }
    for (const scope of other.walk()) {
      for (const sym of scope.symbols.values()) {
        const module = other.modules.get(sym);
        if (module != null)
          this.modules.set(sym, module);
        const kind = other.kinds.get(sym);
        if (kind != null)
          this.kinds.set(sym, kind);
      }
    }
  }
}

class InactiveRegionIndex {
  regions = [];
  open;
  live = new Map;
  skipLine(source) {
    if (!source)
      return;
    const { file, line } = source;
    if (this.open && this.open.file === file && line >= this.open.endLine && line <= this.open.endLine + 1) {
      this.open.endLine = Math.max(this.open.endLine, line);
      return;
    }
    this.flush();
    this.open = { file, startLine: line, endLine: line };
  }
  keepLine(source) {
    if (!source)
      return;
    let lines = this.live.get(source.file);
    if (!lines)
      this.live.set(source.file, lines = new Set);
    lines.add(source.line);
  }
  flush() {
    if (!this.open)
      return;
    this.regions.push({ ...this.open });
    this.open = undefined;
  }
  all() {
    this.flush();
    return this.regions;
  }
  forFile(file) {
    const live = this.live.get(file);
    const dead = new Set;
    for (const r of this.all()) {
      if (r.file !== file)
        continue;
      for (let line = r.startLine;line <= r.endLine; line++) {
        if (!live?.has(line))
          dead.add(line);
      }
    }
    return coalesce(file, [...dead].sort((a, b) => a - b));
  }
  adopt(other) {
    other.flush();
    this.flush();
    const files = new Set([...other.live.keys(), ...other.regions.map((r) => r.file)]);
    const kept = this.regions.filter((r) => !files.has(r.file));
    this.regions.length = 0;
    this.regions.push(...kept, ...other.regions);
    for (const file of files)
      this.live.delete(file);
    for (const [file, lines] of other.live)
      this.live.set(file, new Set(lines));
  }
  get size() {
    return this.all().length;
  }
}
function coalesce(file, lines) {
  const out = [];
  let start;
  let prev = 0;
  for (const line of lines) {
    if (start === undefined) {
      start = prev = line;
    } else if (line === prev + 1) {
      prev = line;
    } else {
      out.push({ file, startLine: start, endLine: prev });
      start = prev = line;
    }
  }
  if (start !== undefined)
    out.push({ file, startLine: start, endLine: prev });
  return out;
}

// src/preamble.ts
var Sim = {
  segments: [{
    name: "ZEROPAGE",
    addressing: 1,
    size: 256,
    memory: 0
  }, {
    name: "CODE",
    default: true,
    offset: 0,
    size: 64768,
    memory: 512,
    free: [[512, 64768]]
  }, {
    name: "RODATA",
    offset: 0,
    size: 64768,
    memory: 512
  }, {
    name: "DATA",
    offset: 0,
    size: 64768,
    memory: 512
  }]
};
var NesNrom = {
  segments: [{
    name: "ZEROPAGE",
    addressing: 1,
    size: 256,
    memory: 0
  }, {
    name: "BSS",
    size: 1536,
    memory: 512
  }, {
    name: "HEADER",
    size: 16,
    offset: 0,
    memory: 0,
    fill: 0
  }, {
    name: "CODE",
    default: true,
    size: 32768,
    offset: 16,
    memory: 32768,
    fill: 0,
    free: [[32768, 65536]]
  }, {
    name: "RODATA",
    size: 32768,
    offset: 16,
    memory: 32768,
    fill: 0
  }, {
    name: "DATA",
    size: 32768,
    offset: 16,
    memory: 32768,
    fill: 0
  }, {
    name: "CHR",
    size: 8192,
    offset: 32784,
    memory: 0,
    fill: 0
  }]
};
var Targets = new Map([
  ["sim", Sim],
  ["nes-nrom", NesNrom]
]);

// src/frontend/sprintf.ts
var re = {
  not_string: /[^s]/,
  not_bool: /[^t]/,
  not_type: /[^T]/,
  not_primitive: /[^v]/,
  number: /[diefg]/,
  numeric_arg: /[bcdiefguxX]/,
  json: /[j]/,
  not_json: /[^j]/,
  text: /^[^\x25]+/,
  modulo: /^\x25{2}/,
  placeholder: new RegExp("^\\x25(?:([1-9]\\d*)\\$|\\(([^)]+)\\))?(\\+)?(0|'[^$])?(-)?(\\d+)?(?:\\.(\\d+))?([b-gijostTuvxX])"),
  key: /^([a-z_][a-z_\d]*)/i,
  key_access: /^\.([a-z_][a-z_\d]*)/i,
  index_access: /^\[(\d+)\]/,
  sign: /^[+-]/
};
var sprintf_cache = Object.create(null);
function sprintf_format(parse_tree, argv) {
  let cursor = 1;
  const tree_length = parse_tree.length;
  let output = "";
  let arg, k, ph, pad, pad_character, pad_length, is_positive = true, sign;
  for (let i = 0;i < tree_length; i++) {
    const node = parse_tree[i];
    if (typeof node === "string") {
      output += node;
      continue;
    }
    ph = node;
    if (ph.keys) {
      arg = argv[cursor];
      for (k = 0;k < ph.keys.length; k++) {
        if (arg == undefined) {
          throw new Error(sprintf('[sprintf] Cannot access property "%s" of undefined value "%s"', ph.keys[k], ph.keys[k - 1]));
        }
        arg = arg[ph.keys[k]];
      }
    } else if (ph.param_no) {
      arg = argv[parseInt(ph.param_no, 10)];
    } else {
      arg = argv[cursor++];
    }
    if (re.not_type.test(ph.type) && re.not_primitive.test(ph.type) && arg instanceof Function) {
      arg = arg();
    }
    if (re.numeric_arg.test(ph.type) && (typeof arg !== "number" && isNaN(arg))) {
      throw new TypeError(sprintf("[sprintf] expecting number but found %T", arg));
    }
    if (re.number.test(ph.type)) {
      is_positive = arg >= 0;
    }
    switch (ph.type) {
      case "b":
        arg = (parseInt(arg, 10) >>> 0).toString(2);
        break;
      case "c":
        arg = String.fromCharCode(parseInt(arg, 10));
        break;
      case "d":
      case "i":
        arg = parseInt(arg, 10);
        break;
      case "j":
        arg = JSON.stringify(arg, null, ph.width ? parseInt(ph.width) : 0);
        break;
      case "e":
        arg = ph.precision ? parseFloat(arg).toExponential(parseInt(ph.precision)) : parseFloat(arg).toExponential();
        break;
      case "f":
        arg = ph.precision ? parseFloat(arg).toFixed(parseInt(ph.precision)) : parseFloat(arg);
        break;
      case "g":
        arg = ph.precision ? String(Number(arg.toPrecision(parseInt(ph.precision)))) : parseFloat(arg);
        break;
      case "o":
        arg = (parseInt(arg, 10) >>> 0).toString(8);
        break;
      case "s":
        arg = String(arg);
        arg = ph.precision ? arg.substring(0, parseInt(ph.precision)) : arg;
        break;
      case "t":
        arg = String(!!arg);
        arg = ph.precision ? arg.substring(0, parseInt(ph.precision)) : arg;
        break;
      case "T":
        arg = Object.prototype.toString.call(arg).slice(8, -1).toLowerCase();
        arg = ph.precision ? arg.substring(0, parseInt(ph.precision)) : arg;
        break;
      case "u":
        arg = parseInt(arg, 10) >>> 0;
        break;
      case "v":
        arg = arg.valueOf();
        arg = ph.precision ? arg.substring(0, parseInt(ph.precision)) : arg;
        break;
      case "x":
        arg = (parseInt(arg, 10) >>> 0).toString(16);
        break;
      case "X":
        arg = (parseInt(arg, 10) >>> 0).toString(16).toUpperCase();
        break;
    }
    if (re.json.test(ph.type)) {
      output += arg;
    } else {
      if (re.number.test(ph.type) && (!is_positive || ph.sign)) {
        sign = is_positive ? "+" : "-";
        arg = arg.toString().replace(re.sign, "");
      } else {
        sign = "";
      }
      pad_character = ph.pad_char ? ph.pad_char === "0" ? "0" : ph.pad_char.charAt(1) : " ";
      pad_length = (ph.width ? parseInt(ph.width) : 0) - (sign + arg).length;
      pad = ph.width ? pad_length > 0 ? pad_character.repeat(pad_length) : "" : "";
      output += ph.align ? sign + arg + pad : pad_character === "0" ? sign + pad + arg : pad + sign + arg;
    }
  }
  return output;
}
function sprintf_parse(fmt) {
  if (sprintf_cache[fmt]) {
    return sprintf_cache[fmt];
  }
  let _fmt = fmt;
  let match;
  const parse_tree = [];
  let arg_names = 0;
  while (_fmt) {
    if ((match = re.text.exec(_fmt)) !== null) {
      parse_tree.push(match[0]);
    } else if ((match = re.modulo.exec(_fmt)) !== null) {
      parse_tree.push("%");
    } else if ((match = re.placeholder.exec(_fmt)) !== null) {
      let keys;
      if (match[2]) {
        arg_names |= 1;
        const field_list = [];
        let replacement_field = match[2];
        let field_match;
        if ((field_match = re.key.exec(replacement_field)) !== null) {
          field_list.push(field_match[1]);
          while ((replacement_field = replacement_field.substring(field_match[0].length)) !== "") {
            if ((field_match = re.key_access.exec(replacement_field)) !== null) {
              field_list.push(field_match[1]);
            } else if ((field_match = re.index_access.exec(replacement_field)) !== null) {
              field_list.push(field_match[1]);
            } else {
              throw new SyntaxError("[sprintf] failed to parse named argument key");
            }
          }
        } else {
          throw new SyntaxError("[sprintf] failed to parse named argument key");
        }
        keys = field_list;
      } else {
        arg_names |= 2;
      }
      if (arg_names === 3) {
        throw new Error("[sprintf] mixing positional and named placeholders is not (yet) supported");
      }
      parse_tree.push({
        placeholder: match[0],
        param_no: match[1],
        keys,
        sign: match[3],
        pad_char: match[4],
        align: match[5],
        width: match[6],
        precision: match[7],
        type: match[8]
      });
    } else {
      throw new SyntaxError("[sprintf] unexpected placeholder");
    }
    _fmt = _fmt.substring(match[0].length);
  }
  return sprintf_cache[fmt] = parse_tree;
}
function sprintf(key, ...args) {
  return sprintf_format(sprintf_parse(key), [key, ...args]);
}
function vsprintf(fmt, argv) {
  return sprintf_format(sprintf_parse(fmt), [fmt, ...argv || []]);
}

// src/frontend/define.ts
var DEBUG = false;

class Define {
  overloads;
  constructor(overloads) {
    this.overloads = overloads;
  }
  canOverload() {
    return this.overloads[this.overloads.length - 1].canOverload();
  }
  get definition() {
    return this.overloads[0]?.definition;
  }
  append(define) {
    if (!this.canOverload()) {
      const prevDef = this.overloads[this.overloads.length - 1].definition;
      const prev = prevDef ? at(prevDef).replace(`
  at`, `
  previously defined at`) : "";
      const nextDef = define.overloads[0].definition;
      fail(`Non-overloadable: ${nameOf(nextDef)}${prev}`, nextDef);
    }
    this.overloads.push(...define.overloads);
  }
  expand(tokens, start) {
    const reasons = [];
    for (const overload of this.overloads) {
      const result = overload.expand(tokens, start);
      if (Array.isArray(result))
        return result;
      reasons.push(result);
    }
    if (DEBUG)
      console.error(reasons.join(`
`));
    return;
  }
  static from(macro) {
    if (!eq(macro[0], DEFINE))
      throw new Error(`invalid`);
    if (macro[1]?.token !== "ident")
      throw new Error(`invalid`);
    const paramStart = macro[2];
    let overload;
    if (!paramStart) {
      overload = new TexStyleDefine([], [], macro[1]);
    } else if (paramStart.token === "grp") {
      overload = new TexStyleDefine(paramStart.inner, macro.slice(3), macro[1]);
    } else if (paramStart.token === "lp") {
      const paramEnd = findBalanced(macro, 2);
      if (paramEnd < 0) {
        fail(`Expected close paren ${nameOf(macro[2])}`, macro[2]);
      }
      overload = new CStyleDefine(identsFromCList(macro.slice(3, paramEnd)), macro.slice(paramEnd + 1), macro[1]);
    } else {
      overload = new TexStyleDefine([], macro.slice(2), macro[1]);
    }
    return new Define([overload]);
  }
}
function produce(tokens, start, end, replacements, production) {
  const splice = [];
  let overflow = [];
  let line = splice;
  for (const tok of production) {
    if (tok.token === "ident") {
      const param = replacements.get(tok.str);
      if (param) {
        line.push(...param);
        continue;
      }
    } else if (eq(tok, DOT_EOL)) {
      overflow.push(line = []);
      continue;
    }
    line.push(reparentSource(tok, tokens[0].source));
  }
  overflow = overflow.filter((l) => l.length);
  if (overflow.length && end < tokens.length) {
    return "cannot expand .eol without consuming to end of line";
  }
  tokens.splice(start, end - start, ...splice);
  return overflow;
}

class CStyleDefine {
  params;
  production;
  definition;
  constructor(params, production, definition) {
    this.params = params;
    this.production = production;
    this.definition = definition;
  }
  expand(tokens, start) {
    let i = start + 1;
    let splice = this.params.length ? tokens.length : start;
    let end = splice;
    const replacements = new Map;
    if (start < tokens.length && eq(LP, tokens[i])) {
      end = findBalanced(tokens, i);
      if (end < 0) {
        return "missing close paren for enclosed C-style expansion";
      }
      splice = end + 1;
      i++;
    }
    const args = parseArgList(tokens, i, end);
    if (args.length > this.params.length) {
      return "too many args";
    }
    for (i = 0;i < this.params.length; i++) {
      let arg = args[i] || [];
      const front = arg[0];
      if (arg.length === 1 && front.token === "grp") {
        arg = front.inner;
      }
      replacements.set(this.params[i], arg);
    }
    return produce(tokens, start, splice, replacements, this.production);
  }
  canOverload() {
    return Boolean(this.params.length);
  }
}

class TexStyleDefine {
  pattern;
  production;
  definition;
  constructor(pattern, production, definition) {
    this.pattern = pattern;
    this.production = production;
    this.definition = definition;
  }
  expand(tokens, start) {
    let i = start + 1;
    const replacements = new Map;
    for (let patPos = 0;patPos < this.pattern.length; patPos++) {
      const pat = this.pattern[patPos];
      if (pat.token === "ident") {
        const delim = this.pattern[patPos + 1];
        if (!delim || delim?.token === "ident") {
          const tok = tokens[i++];
          if (!tok)
            return `missing undelimited argument ${name(pat)}`;
          replacements.set(pat.str, tok.token === "grp" ? tok.inner : [tok]);
        } else {
          const end = eq(delim, DOT_EOL) ? tokens.length : find(tokens, delim, i);
          if (end < 0)
            return `could not find delimiter ${name(delim)}`;
          replacements.set(pat.str, tokens.slice(i, end));
          i = end;
        }
      } else if (eq(pat, DOT_EOL)) {
        if (i < tokens.length)
          return `could not match .eol`;
      } else {
        if (!eq(tokens[i++], pat)) {
          return `could not match: ${name(pat)}`;
        }
      }
    }
    return produce(tokens, start, i, replacements, this.production);
  }
  canOverload() {
    return Boolean(this.pattern.length);
  }
}

// src/frontend/macro.ts
class Macro {
  params;
  production;
  definition;
  constructor(params, production, definition) {
    this.params = params;
    this.production = production;
    this.definition = definition;
  }
  static from(line, source) {
    if (!eq(line[0], MACRO))
      throw new Error(`invalid`);
    if (line[1]?.token !== "ident")
      throw new Error(`invalid`);
    const params = identsFromCList(line.slice(2));
    const lines = [];
    let macro;
    pullLines(source, (next) => {
      if (!next) {
        fail(`EOF looking for .endmacro: ${nameOf(line[1])}`, line[1]);
      }
      if (eq(next[0], ENDMACRO)) {
        macro = new Macro(params, lines, line[1]);
        return false;
      }
      lines.push(next);
      return true;
    });
    return macro;
  }
  expand(tokens, idGen) {
    let i = 1;
    const replacements = new Map;
    const lines = [];
    const paramCount = Macro.countArgs(tokens, 1);
    for (const param of this.params) {
      const comma = findComma(tokens, i);
      let slice = tokens.slice(i, comma);
      i = comma + 1;
      if (slice.length === 1 && slice[0].token === "grp") {
        slice = slice[0].inner;
      }
      replacements.set(param, slice);
    }
    if (i < tokens.length) {
      fail(`Too many macro parameters: ${nameOf(tokens[i])}`, tokens[i]);
    }
    const locals = new Map;
    const callSource = tokens[0].source;
    const map = (toks) => {
      const mapped = [];
      for (const tok of toks) {
        if (eq(tok, LOCAL))
          return mapped;
        if (tok.token === "ident") {
          const param = replacements.get(tok.str);
          if (param) {
            mapped.push(...param);
            continue;
          }
          const local = locals.get(tok.str);
          if (local) {
            mapped.push({ token: "ident", str: local });
            continue;
          }
        } else if (tok.token === "cs" && tok.str === ".paramcount") {
          mapped.push({ token: "num", num: paramCount, radix: 10, source: tok.source });
          continue;
        } else if (tok.token === "grp") {
          mapped.push({ token: "grp", inner: map(tok.inner) });
          continue;
        }
        mapped.push(reparentSource(tok, callSource));
      }
      return mapped;
    };
    for (const line of this.production) {
      if (eq(line[0], LOCAL)) {
        const locallist = identsFromCList(line.slice(1));
        for (const local of locallist) {
          locals.set(local, `${local}@${idGen.next()}`);
        }
      }
      lines.push(map(line));
    }
    return lines.filter((m) => m.length != 0);
  }
  static countArgs(tokens, start) {
    if (start >= tokens.length)
      return 0;
    let count = 1;
    for (let i = start;i < tokens.length; i++) {
      if (eq(tokens[i], COMMA))
        count++;
    }
    return count;
  }
}

// src/frontend/preprocessor.ts
var MAX_STACK_DEPTH = 100;
var VALUE_END = new Set(["num", "str", "rb", "rp", "rc", "grp"]);
var BANK_QUERY_OPS = new Set(["^", ".bankbyte", ".addrsize"]);
var JS65_VERSION = 531;
var JS65_CPU_ISET = 3;
var REGISTER_SIZE = 8;
var ID_MAP = new WeakMap;
function idGen(asm) {
  let id = ID_MAP.get(asm);
  if (!id)
    ID_MAP.set(asm, id = ((num) => ({ next: () => num++ }))(0));
  return id;
}
class Preprocessor {
  stream;
  asm;
  errorCollector;
  macros;
  repeats = [];
  macroIndex;
  inactiveRegionIndex;
  rawMode = 0;
  conds = [];
  constructor(stream, asm, parent, errorCollector, macroIndex, inactiveRegionIndex) {
    this.stream = stream;
    this.asm = asm;
    this.errorCollector = errorCollector;
    this.macros = parent ? parent.macros : new Map;
    if (!errorCollector && parent?.errorCollector) {
      this.errorCollector = parent.errorCollector;
    }
    this.macroIndex = macroIndex ?? parent?.macroIndex;
    this.inactiveRegionIndex = inactiveRegionIndex ?? parent?.inactiveRegionIndex;
  }
  run(signal) {
    while (!this.asm.ended) {
      if (signal?.aborted)
        throw new FatalError("Compilation cancelled");
      try {
        const line = this.readLine();
        if (line == null)
          return;
        this.pumpLine(line);
      } catch (err) {
        this.recover(err);
      }
    }
  }
  recover(err) {
    if (err instanceof RecoverableError) {
      return;
    }
    if (err instanceof FatalError)
      throw err;
    if (err instanceof SourceError && this.errorCollector) {
      if (!err.recorded) {
        err.recorded = true;
        this.errorCollector.addFromException(err);
      }
      return;
    }
    throw err;
  }
  pumpLine(line) {
    while (line.length) {
      const front = line[0];
      switch (front.token) {
        case "ident": {
          const callable = this.macros.get(front.str) instanceof Macro || this.asm.isMnemonic(front.str) && !this.asm.allowsUbiquitousIdents();
          if (!callable && eq(line[1], COLON)) {
            const label = line.splice(0, 2);
            if (line.length)
              label[0] = labelsData(front);
            this.asm.line(label);
            break;
          }
          const assigns = eq(line[1], ASSIGN) || eq(line[1], ASSIGN_LABEL) || eq(line[1], SET);
          if (!assigns && !callable && this.asm.allowsLabelWithoutColon()) {
            line.splice(0, 1);
            const label = [line.length ? labelsData(front) : front, COLON];
            this.asm.line(label);
            break;
          }
          if (this.asm.allowsMultiOpsPerLine() && this.startsStatement(front.str)) {
            const split = this.findNextStatement(line);
            if (split > 0) {
              const rest = line.splice(split);
              const macro = this.macros.get(front.str);
              if (macro instanceof Macro) {
                this.stream.unshift(rest);
                this.tryExpandMacro(line);
                return;
              }
              this.asm.line(line);
              line = rest;
              break;
            }
          }
          if (!this.tryExpandMacro(line))
            this.asm.line(line);
          return;
        }
        case "cs": {
          const ran = this.tryRunDirective(line);
          if (!ran)
            this.asm.line(line);
          return;
        }
        case "op":
          if (front.str === "*" && eq(line[1], ASSIGN)) {
            if (!this.asm.allowsPcAssignment()) {
              fail(`\`*=\` requires the pc_assignment feature`, front);
            }
            this.asm.line(line);
            return;
          }
          if (/^[-+]+$/.test(front.str)) {
            const label = [front];
            const second = line[1];
            if (second && eq(second, COLON)) {
              label.push(second);
              line.splice(0, 2);
            } else {
              label.push({ token: "op", str: ":" });
              line.splice(0, 1);
            }
            this.asm.line(label);
            break;
          } else if (front.str === ":") {
            this.asm.line(line.splice(0, 1));
            break;
          }
        default:
          fail(`Unexpected: ${nameOf(line[0])}`, line[0]);
      }
    }
  }
  readLine() {
    for (;; ) {
      const line = this.stream.next();
      if (line == null)
        return this.endOfInput();
      const n = this.conds.length;
      if (n === 0)
        return this.expandLine(line);
      const top = this.conds[n - 1];
      if (top.state === "live") {
        this.inactiveRegionIndex?.keepLine(sourceOfLine(line));
        return this.expandLine(line);
      }
      this.skipDeadLine(line, top);
    }
  }
  endOfInput() {
    if (!this.conds.length)
      return;
    const at = this.conds[0].at;
    this.conds.length = 0;
    fail(`EOF looking for .endif`, at);
  }
  skipDeadLine(line, top) {
    const dead = this.inactiveRegionIndex;
    let front = line[0];
    if (front?.token === "ident" && this.macros.get(front.str) instanceof Define) {
      this.expandDefines(line);
      front = line[0];
    }
    if (!front)
      return;
    if (front.token === "cs") {
      if (front.str !== ".endif" && (front.str.startsWith(".if") || front.str.startsWith(".else"))) {
        this.asm.noteLine(front.source);
      }
      switch (front.str) {
        case ".endif": {
          this.conds.pop();
          const parent = this.conds[this.conds.length - 1];
          if (!parent || parent.state === "live") {
            dead?.flush();
          } else {
            dead?.skipLine(sourceOfLine(line));
          }
          return;
        }
        case ".else":
          if (top.state !== "pending" && top.state !== "guessed")
            break;
          dead?.flush();
          top.state = "live";
          return;
        case ".elseif":
          if (top.state !== "pending")
            break;
          dead?.flush();
          this.elseIf(line, top);
          return;
        case ".include":
        case ".incbin":
          this.preload(line, front.str === ".incbin");
          break;
        default:
          if (front.str.startsWith(".if")) {
            this.conds.push({ at: front, state: "done", depth: this.stream.depth });
          }
      }
    }
    dead?.skipLine(sourceOfLine(line));
  }
  preload(line, binary) {
    const path = line[1];
    if (path?.token !== "str" || !this.conds.some((f) => f.state === "guessed"))
      return;
    this.stream.preload(path.str, binary);
  }
  elseIf(line, top) {
    const cs = line[0];
    const outcome = this.condition(() => {
      this.expandLayers(line, 3 /* ALL */, 1);
      return this.ifValue(parseOneExpr(line.slice(1), cs, this.asm.encodeChar), line);
    }, cs);
    top.state = armState(outcome);
  }
  ifValue(expr, line) {
    this.asm.conditionRefs(expr, line[0].source);
    const r = this.evaluateConstOrDefer(expr, line[0]);
    if (!("deferred" in r))
      return { value: !!r.value };
    const late = this.asm.lateCondition(line);
    return late === undefined ? r : { value: late };
  }
  openIf(line, test) {
    const at = line[0];
    this.asm.noteLine(at.source);
    const state = armState(this.condition(test, at));
    this.conds.push({ at, state, depth: this.stream.depth });
  }
  nextBranch(line) {
    const top = this.conds[this.conds.length - 1];
    if (!top)
      badClose(".if", line[0]);
    this.asm.noteLine(line[0].source);
    top.state = "done";
  }
  closeIf(line) {
    if (!this.conds.pop())
      badClose(".if", line[0]);
    this.inactiveRegionIndex?.flush();
  }
  exitMacro() {
    this.stream.exit();
    const depth = this.stream.depth;
    while (this.conds.length && this.conds[this.conds.length - 1].depth > depth) {
      this.conds.pop();
    }
  }
  expandDefines(line, pos = 0) {
    return this.expandLayers(line, 1 /* DEFINES */, pos);
  }
  expandLine(line, pos = 0) {
    const layers = this.rawMode ? 1 /* DEFINES */ : 3 /* ALL */;
    return this.expandLayers(line, layers, pos);
  }
  inRawMode(f) {
    this.rawMode++;
    try {
      return f();
    } finally {
      this.rawMode--;
    }
  }
  defineExpanded = {
    next: () => {
      const line = this.stream.next();
      return line == null ? line : this.expandDefines(line);
    }
  };
  collectBody(f) {
    return this.inRawMode(() => f(this.defineExpanded));
  }
  expandLayers(line, layers, pos) {
    const front = line[0];
    let depth = 0;
    let maxPos = 0;
    while (pos < line.length) {
      const token = line[pos].token;
      if (token !== "ident" && token !== "cs" && token !== "grp") {
        if (pos > maxPos)
          maxPos = pos;
        pos++;
        continue;
      }
      if (pos > maxPos) {
        maxPos = pos;
        depth = 0;
      } else if (depth++ > MAX_STACK_DEPTH) {
        fail(`Maximum expansion depth reached: ${line.map(name).join(" ")}`, front);
      }
      pos = this.expandToken(line, pos, layers);
    }
    return line;
  }
  checkNotMnemonic(name, at) {
    if (this.asm.isMnemonic(name) && !this.asm.allowsUbiquitousIdents()) {
      fail(`Macro may not be named after the instruction ${name} ` + `(enable it with '.feature ubiquitous_idents')`, at);
    }
  }
  isCallable(name) {
    return this.macros.get(name) instanceof Macro || this.asm.isMnemonic(name);
  }
  startsStatement(name) {
    const macro = this.macros.get(name);
    if (macro instanceof Macro)
      return !macro.params.length;
    return this.asm.isMnemonic(name);
  }
  findNextStatement(line) {
    let depth = 0;
    for (let i = 1;i < line.length; i++) {
      const tok = line[i];
      switch (tok.token) {
        case "lp":
        case "lb":
          depth++;
          continue;
        case "rp":
        case "rb":
          depth--;
          continue;
        case "ident":
          break;
        default:
          continue;
      }
      if (depth)
        continue;
      if (eq(line[i + 1], COLON)) {
        fail(`A label must start its own line: ${tok.str}`, tok);
      }
      if (!this.startsStatement(tok.str))
        continue;
      switch (line[i - 1].token) {
        case "num":
        case "str":
        case "ident":
        case "rp":
        case "rb":
        case "grp":
          return i;
      }
    }
    return -1;
  }
  mergeScopePrefix(line, pos) {
    if (pos < 1 || !eq(line[pos - 1], DCOLON))
      return pos;
    const ident = line[pos];
    if (ident.token !== "ident")
      return pos;
    const before = pos >= 2 ? line[pos - 2] : undefined;
    if (before && before.token !== "ident" && VALUE_END.has(before.token)) {
      return pos;
    }
    const scope = before?.token === "ident" && !this.isCallable(before.str) ? before.str : "";
    const start = scope ? pos - 2 : pos - 1;
    line.splice(start, pos - start + 1, { token: "ident", str: `${scope}::${ident.str}`, source: ident.source });
    return start;
  }
  expandToken(line, pos, layers = 3 /* ALL */) {
    const front = line[pos];
    if (front.token === "ident") {
      if (!(layers & 1 /* DEFINES */))
        return pos + 1;
      const define = this.macros.get(front.str);
      if (define instanceof Define) {
        const overflow = define.expand(line, pos);
        if (overflow) {
          if (overflow.length)
            this.stream.unshift(...overflow);
          return pos;
        }
      }
      return this.mergeScopePrefix(line, pos) + 1;
    } else if (front.token === "cs") {
      return this.expandDirective(front.str, line, pos, layers);
    } else if (front.token === "grp") {
      this.expandLayers(front.inner, layers, 0);
    }
    return pos + 1;
  }
  tryExpandMacro(line) {
    const [first] = line;
    if (first.token !== "ident")
      throw new Error(`impossible`);
    const macro = this.macros.get(first.str);
    if (!(macro instanceof Macro))
      return false;
    const expansion = macro.expand(line, idGen(this.asm));
    this.stream.enter();
    this.stream.unshift(...expansion);
    return true;
  }
  expandDirective(directive, line, i, layers = 3 /* ALL */) {
    switch (directive) {
      case ".define":
      case ".delmacro":
      case ".ifdef":
      case ".ifndef":
      case ".undefine":
        return this.skipIdentifier(line, i);
      case ".skip":
        return this.skip(line, i, layers);
      case ".noexpand":
        return this.noexpand(line, i);
    }
    if (!(layers & 2 /* FUNCTIONS */))
      return i + 1;
    switch (directive) {
      case ".tcount":
        return this.parseArgs(line, i, 1, this.tcount, layers);
      case ".match":
        return this.parseArgs(line, i, 2, this.matchTokens, layers);
      case ".xmatch":
        return this.parseArgs(line, i, 2, this.xmatchTokens, layers);
      case ".left":
        return this.parseArgs(line, i, 2, this.left, layers);
      case ".right":
        return this.parseArgs(line, i, 2, this.right, layers);
      case ".mid":
        return this.parseArgs(line, i, 3, this.mid, layers);
      case ".ident":
        return this.parseArgs(line, i, 1, this.ident, layers);
      case ".string":
        return this.parseArgs(line, i, 1, this.string, layers);
      case ".concat":
        return this.parseArgs(line, i, 0, this.concat, layers);
      case ".sprintf":
        return this.parseArgs(line, i, 0, this.sprintf, layers);
      case ".cond":
        return this.parseArgs(line, i, 3, this.cond, layers);
      case ".blank":
        return this.parseArgs(line, i, 1, this.blank, layers);
      case ".const":
        return this.parseArgs(line, i, 1, this.constExpr, layers);
      case ".defined":
        return this.parseArgs(line, i, 1, this.definedSymbol, layers);
      case ".definedmacro":
        return this.parseArgs(line, i, 1, this.definedMacro, layers);
      case ".definedsymbol":
        return this.parseArgs(line, i, 1, this.definedSymbol, layers);
      case ".ismnemonic":
        return this.parseArgs(line, i, 1, this.isMnemonic, layers);
      case ".constantsymbol":
        return this.parseArgs(line, i, 1, this.constantSymbol, layers);
      case ".referencedsymbol":
        return this.parseArgs(line, i, 1, this.referencedSymbol, layers);
      case ".time":
        return this.pseudoVariable(line, i, Math.floor(Date.now() / 1000));
      case ".version":
        return this.pseudoVariable(line, i, JS65_VERSION);
      case ".asize":
      case ".isize":
        return this.pseudoVariable(line, i, REGISTER_SIZE);
      case ".cpu":
        return this.pseudoVariable(line, i, JS65_CPU_ISET);
    }
    return i + 1;
  }
  pseudoVariable(line, i, num) {
    line.splice(i, 1, { token: "num", num, source: line[i].source });
    return i + 1;
  }
  skip(line, i, layers = 3 /* ALL */) {
    line.splice(i, 1);
    const skipped = line[i];
    if (skipped?.token === "grp") {
      this.expandToken(skipped.inner, 0, layers);
    } else {
      this.expandToken(line, i + 1, layers);
    }
    return i;
  }
  noexpand(line, i) {
    const skip = line[i + 1];
    if (skip.token === "grp") {
      line.splice(i, 2, ...skip.inner);
      i += skip.inner.length - 1;
    } else {
      line.splice(i, 1);
    }
    return i + 1;
  }
  parseArgs(line, i, argCount, fn, layers = 3 /* ALL */) {
    const cs = line[i];
    expect(LP, line[i + 1], cs);
    const end = findBalanced(line, i + 1);
    const args = parseArgList(line, i + 2, end).map((ts) => {
      if (ts.length === 1 && ts[0].token === "grp")
        ts = ts[0].inner;
      return this.expandLayers(ts, layers, 0);
    });
    if (argCount && args.length !== argCount) {
      fail(`Expected ${argCount} parameters: ${nameOf(cs)}`, cs);
    }
    const expansion = fn.call(this, cs, ...args);
    line.splice(i, end + 1 - i, ...expansion);
    return i;
  }
  tcount(cs, arg) {
    return [numToken(count(arg), cs.source)];
  }
  static tokensEqual(a, b, exact) {
    if (a.length !== b.length)
      return false;
    for (let k = 0;k < a.length; k++) {
      const x = a[k], y = b[k];
      if (x.token !== y.token)
        return false;
      switch (x.token) {
        case "ident":
        case "str":
          if (exact && x.str !== y.str)
            return false;
          break;
        case "num":
          if (exact && x.num !== y.num)
            return false;
          break;
        case "op":
        case "cs":
          if (x.str !== y.str)
            return false;
          break;
        default:
          break;
      }
    }
    return true;
  }
  matchTokens(cs, a, b) {
    return [numToken(Preprocessor.tokensEqual(a, b, false) ? 1 : 0, cs.source)];
  }
  xmatchTokens(cs, a, b) {
    return [numToken(Preprocessor.tokensEqual(a, b, true) ? 1 : 0, cs.source)];
  }
  constCount(toks, cs) {
    try {
      return this.evaluateConst(parseOneExpr(toks, cs, this.asm.encodeChar), cs);
    } catch {
      fail(`Expected a constant token count`, cs);
    }
  }
  left(cs, count, list) {
    const n = Math.max(0, this.constCount(count, cs));
    return list.slice(0, n);
  }
  right(cs, count, list) {
    const n = Math.max(0, this.constCount(count, cs));
    return n >= list.length ? list.slice() : list.slice(list.length - n);
  }
  mid(cs, start, count, list) {
    const s = Math.max(0, this.constCount(start, cs));
    const n = Math.max(0, this.constCount(count, cs));
    return list.slice(s, s + n);
  }
  ident(cs, arg) {
    const str = expectString(arg[0], cs);
    expectEol(arg[1], "a single token");
    return [{ token: "ident", str, source: arg[0].source }];
  }
  string(cs, arg) {
    const str = expectIdentifier(arg[0], cs);
    expectEol(arg[1], "a single token");
    return [{ token: "str", str, source: arg[0].source }];
  }
  concat(cs, ...args) {
    const strs = args.map((ts) => {
      const str = expectString(ts[0]);
      expectEol(ts[1], "a single string");
      return str;
    });
    return [{ token: "str", str: strs.join(""), source: cs.source }];
  }
  sprintf(cs, fmtToks, ..._args) {
    const fmtRe = /^%(%|-?0?\d*(\.\d+)?[diouXxsc])/;
    const fmt = expectString(fmtToks[0], cs);
    let sprintfFmt = "";
    const sprintfArgs = [];
    let prevTok = fmtToks.slice(-1)[0];
    let offs = 0, argIdx = 0;
    while (offs < fmt.length) {
      let pctOffs = fmt.indexOf("%", offs);
      if (pctOffs < 0)
        pctOffs = fmt.length;
      if (pctOffs != offs) {
        sprintfFmt += fmt.slice(offs, pctOffs);
        offs = pctOffs;
      } else {
        const match = fmtRe.exec(fmt.substring(offs));
        if (!match)
          throw new Error("invalid format string");
        const specType = match[0].slice(-1);
        if (specType != "%") {
          const argToks = _args[argIdx];
          let arg = 0;
          if (specType == "s")
            arg = expectString(argToks[0], prevTok);
          else
            arg = this.evaluateConst(parseOneExpr(argToks, prevTok, this.asm.encodeChar));
          sprintfArgs.push(arg);
          argIdx++;
          prevTok = argToks.slice(-1)[0];
        }
        sprintfFmt += match[0];
        offs += match[0].length;
      }
    }
    return [{ token: "str", str: vsprintf(sprintfFmt, sprintfArgs), source: cs.source }];
  }
  cond(cs, cond, ifTrue, ifFalse) {
    const v = this.evaluateConst(parseOneExpr(cond, cs, this.asm.encodeChar), cs);
    return v ? ifTrue : ifFalse;
  }
  blank(cs, arg) {
    return [numToken(arg.length === 0 ? 1 : 0, cs.source)];
  }
  constExpr(cs, arg) {
    const expr = parseOneExpr(arg, cs, this.asm.encodeChar);
    this.asm.conditionRefs(expr, cs.source);
    let known = true;
    try {
      this.evaluateConst(expr, cs, false);
    } catch {
      known = false;
    }
    return [numToken(known ? 1 : 0, cs.source)];
  }
  definedMacro(cs, arg) {
    const ident = expectIdentifier(arg[0], cs);
    expectEol(arg[1], "a single identifier");
    return [numToken(this.macros.get(ident) instanceof Macro ? 1 : 0, cs.source)];
  }
  isMnemonic(cs, arg) {
    const ident = expectIdentifier(arg[0], cs);
    expectEol(arg[1], "a single identifier");
    return [numToken(this.asm.isMnemonic(ident) ? 1 : 0, cs.source)];
  }
  definedSymbol(cs, arg) {
    const ident = expectIdentifier(arg[0], cs);
    expectEol(arg[1], "a single identifier");
    return [numToken(this.asm.definedSymbol(ident) ? 1 : 0, cs.source)];
  }
  constantSymbol(cs, arg) {
    const ident = expectIdentifier(arg[0], cs);
    expectEol(arg[1], "a single identifier");
    return [numToken(this.asm.constantSymbol(ident) ? 1 : 0, cs.source)];
  }
  referencedSymbol(cs, arg) {
    const ident = expectIdentifier(arg[0], cs);
    expectEol(arg[1], "a single identifier");
    return [numToken(this.asm.referencedSymbol(ident) ? 1 : 0, cs.source)];
  }
  skipIdentifier(line, i) {
    return line[i + 1]?.token === "ident" ? i + 2 : i + 1;
  }
  tryRunDirective(line) {
    const first = line[0];
    if (first.token !== "cs")
      throw new Error(`impossible`);
    const handler = this.runDirectives[first.str];
    if (!handler)
      return false;
    handler(line);
    return true;
  }
  reduceConst(expr, addresses) {
    const evalWrapper = (ex) => {
      if (ex.op === "sym" && ex.sym) {
        const val = this.asm.definedValue(ex.sym);
        if (val && (addresses || !isAddress3(val)))
          return evaluate(val);
      }
      return evaluate(ex);
    };
    const truthy = (n) => n === undefined ? undefined : n !== 0;
    const evalNode = (ex) => {
      const isAnd = ex.op === "&&" || ex.op === ".and";
      const isOr = ex.op === "||" || ex.op === ".or";
      if ((isAnd || isOr) && ex.args?.length === 2) {
        const l = truthy(evalNode(ex.args[0]));
        if (isAnd && l === false)
          return 0;
        if (isOr && l === true)
          return 1;
        const r = truthy(evalNode(ex.args[1]));
        if (l === undefined || r === undefined)
          return;
        return (isAnd ? l && r : l || r) ? 1 : 0;
      }
      const reduced = traversePost(ex, evalWrapper);
      return reduced.op === "num" && !reduced.meta?.rel ? reduced.num : undefined;
    };
    const v = evalNode(expr);
    if (v !== undefined)
      return { value: v };
    return { reduced: traversePost(expr, evalWrapper) };
  }
  failNotConstant(reduced, source) {
    const desc = reduced.op === "sym" ? `symbol ${reduced.sym}` : `${reduced.op} expression`;
    fail(`Expected a constant: ${desc}`, reduced.source ?? source);
  }
  evaluateConst(expr, source, addresses = true) {
    const r = this.reduceConst(expr, addresses);
    if ("value" in r)
      return r.value;
    this.failNotConstant(r.reduced, source);
  }
  evaluateConstOrDefer(expr, source) {
    const r = this.reduceConst(expr, true);
    if ("value" in r)
      return r;
    if (this.asm.opts.lto !== false && this.canDefer(r.reduced))
      return { deferred: true };
    this.failNotConstant(r.reduced, source);
  }
  canDefer(ex) {
    if (ex.op === "num" && !ex.meta?.rel)
      return true;
    if (ex.op === "im" && ex.sym != null)
      return true;
    if (ex.meta?.rel && ex.meta?.chunk != null)
      return true;
    if (ex.op === "sym" && ex.sym != null)
      return this.asm.definedSymbol(ex.sym);
    if (!ex.args?.length)
      return false;
    if (BANK_QUERY_OPS.has(ex.op) && ex.args.length === 1 && ex.args[0].op === "sym" && ex.args[0].sym != null) {
      return true;
    }
    return ex.args.every((arg) => this.canDefer(arg));
  }
  runDirectives = {
    ".define": (line) => this.parseDefine(line),
    ".delmacro": (line) => this.parseDelMacro(line),
    ".undefine": (line) => this.parseUndefine(line),
    ".else": (line) => this.nextBranch(line),
    ".elseif": (line) => this.nextBranch(line),
    ".endif": (line) => this.closeIf(line),
    ".endmacro": ([cs]) => badClose(".macro", cs),
    ".endrepeat": (line) => this.parseEndRepeat(line),
    ".exitmacro": ([, a]) => {
      noGarbage(a);
      this.exitMacro();
    },
    ".if": (line) => {
      const [cs, ...args] = line;
      const expr = parseOneExpr(args, cs, this.asm.encodeChar);
      this.openIf(line, () => this.ifValue(expr, line));
    },
    ".ifdef": (line) => {
      const [cs, ...args] = line;
      this.openIf(line, () => ({ value: this.parseIfDef(args, cs) }));
    },
    ".ifndef": (line) => {
      const [cs, ...args] = line;
      this.openIf(line, () => ({ value: !this.parseIfDef(args, cs) }));
    },
    ".ifblank": (line) => this.openIf(line, () => ({ value: line.length <= 1 })),
    ".ifnblank": (line) => this.openIf(line, () => ({ value: line.length > 1 })),
    ".ifref": (line) => {
      const [cs, ...args] = line;
      this.openIf(line, () => ({ value: this.asm.referencedSymbol(parseOneIdent(args, cs)) }));
    },
    ".ifnref": (line) => {
      const [cs, ...args] = line;
      this.openIf(line, () => ({ value: !this.asm.referencedSymbol(parseOneIdent(args, cs)) }));
    },
    ".ifsym": (line) => {
      const [cs, ...args] = line;
      this.openIf(line, () => ({ value: this.asm.definedSymbol(parseOneIdent(args, cs)) }));
    },
    ".ifnsym": (line) => {
      const [cs, ...args] = line;
      this.openIf(line, () => ({ value: !this.asm.definedSymbol(parseOneIdent(args, cs)) }));
    },
    ".ifconst": (line) => {
      const [cs, ...args] = line;
      this.openIf(line, () => ({ value: this.asm.constantSymbol(parseOneIdent(args, cs)) }));
    },
    ".ifnconst": (line) => {
      const [cs, ...args] = line;
      this.openIf(line, () => ({ value: !this.asm.constantSymbol(parseOneIdent(args, cs)) }));
    },
    ".ifp02": (line) => this.openIf(line, () => ({ value: true })),
    ".ifp4510": (line) => this.openIf(line, () => ({ value: false })),
    ".ifp816": (line) => this.openIf(line, () => ({ value: false })),
    ".ifpc02": (line) => this.openIf(line, () => ({ value: false })),
    ".ifpdtv": (line) => this.openIf(line, () => ({ value: false })),
    ".ifpsc02": (line) => this.openIf(line, () => ({ value: false })),
    ".incbin": (line) => this.parseIncbin(line),
    ".include": (line) => this.parseInclude(line),
    ".macpack": (line) => this.parseMacpack(line),
    ".macro": (line) => this.parseMacro(line),
    ".repeat": (line) => this.parseRepeat(line)
  };
  parseInclude(line) {
    const [cs, ...rest] = line;
    const path = expectString(rest[0], cs);
    expectEol(rest[1], "a single string");
    this.stream.include(path, cs);
  }
  parseMacpack(line) {
    const [cs, ident, eol] = line;
    const pack = expectIdentifier(ident, cs).toLowerCase();
    expectEol(eol);
    this.stream.macpack(pack, cs);
  }
  parseIncbin(line) {
    const cs = line[0];
    const args = parseArgList(line, 1);
    const [file, ...rest] = args;
    const path = expectString(file[0], cs);
    expectEol(file[1], "a single string");
    if (rest.length > 2)
      fail(`Too many arguments for .incbin`, cs);
    const [offset, length] = rest.map((arg) => this.evaluateConst(parseOneExpr(arg, cs, this.asm.encodeChar), cs));
    const bin = this.stream.incbin(path, offset ?? 0, length, cs);
    const bytestr = cs.source ? { ...BYTESTR, source: cs.source } : BYTESTR;
    this.asm.line([bytestr, { token: "str", str: bin }]);
  }
  parseDefine(line) {
    const name = expectIdentifier(line[1], line[0]);
    this.checkNotMnemonic(name, line[1]);
    const define = Define.from(line);
    const prev = this.macros.get(name);
    if (prev instanceof Define) {
      prev.append(define);
    } else if (prev) {
      fail(`Already defined: ${name}`, line[1]);
    } else {
      this.macros.set(name, define);
    }
    const recorded = this.macros.get(name);
    if (recorded instanceof Define) {
      this.macroIndex?.record(name, "define", recorded, recorded.definition?.source);
    }
  }
  parseUndefine(line) {
    const [cs, ident, eol] = line;
    const name = expectIdentifier(ident, cs);
    expectEol(eol);
    const prev = this.macros.get(name);
    if (!prev) {
      fail(`Not defined: ${nameOf(ident)}`, ident);
    }
    if (prev instanceof Macro) {
      fail(`Not a .define macro: ${nameOf(ident)}`, ident);
    }
    this.macros.delete(name);
    this.macroIndex?.remove(name);
  }
  parseDelMacro(line) {
    const [cs, ident, eol] = line;
    const name = expectIdentifier(ident, cs);
    expectEol(eol);
    const prev = this.macros.get(name);
    if (!prev) {
      fail(`Not defined: ${nameOf(ident)}`, ident);
    }
    if (!(prev instanceof Macro)) {
      fail(`Not a .macro: ${nameOf(ident)}`, ident);
    }
    this.macros.delete(name);
    this.macroIndex?.remove(name);
  }
  parseMacro(line) {
    const name = expectIdentifier(line[1], line[0]);
    const macro = this.collectBody((source) => Macro.from(line, source));
    this.checkNotMnemonic(name, line[1]);
    const prev = this.macros.get(name);
    if (prev)
      fail(`Already defined: ${name}`, line[1]);
    this.macros.set(name, macro);
    this.macroIndex?.record(name, "macro", macro, macro.definition?.source);
  }
  parseRepeat(line) {
    const [expr, end] = parse(line, 1, undefined, this.asm.encodeChar);
    const at = line[1] || line[0];
    if (!expr)
      fail(`Expected expression: ${nameOf(at)}`, at);
    const times = this.evaluateConst(expr);
    if (times == null)
      fail(`Expected a constant`, expr);
    let ident;
    if (end < line.length) {
      if (!eq(line[end], COMMA)) {
        fail(`Expected comma: ${nameOf(line[end])}`, line[end]);
      }
      ident = expectIdentifier(line[end + 1]);
      expectEol(line[end + 2]);
    }
    const lines = [];
    let depth = 1;
    const start = line[0];
    let last = line;
    this.collectBody((source) => pullLines(source, (next) => {
      last = next ?? fail(`.repeat with no .endrep`, start);
      if (eq(last[0], REPEAT))
        depth++;
      if (eq(last[0], ENDREPEAT))
        depth--;
      lines.push(last);
      return depth > 0;
    }));
    this.repeats.push([lines, times, -1, ident]);
    this.parseEndRepeat(last);
  }
  parseEndRepeat(line) {
    expectEol(line[1]);
    const top = this.repeats.pop();
    if (!top)
      fail(`.endrep with no .repeat`, line[0]);
    if (++top[2] >= top[1])
      return;
    this.repeats.push(top);
    const tag = this.asm.opts.generateDebugInfo ? this.repeats.length : 0;
    const end = line[0].source?.repeatEnd ?? line[0].source;
    this.stream.unshift(...top[0].map((line) => line.map((token) => {
      if (token.token === "ident" && token.str === top[3]) {
        return numToken(top[2], token.source);
      }
      return tag ? withRepeat(token, tag, end) : token;
    })));
  }
  condition(test, at) {
    try {
      return test();
    } catch (err) {
      if (err instanceof FatalError || !(err instanceof SourceError) || !this.errorCollector) {
        throw err;
      }
      if (!err.recorded) {
        err.recorded = true;
        this.errorCollector.addFromException(err, err.source ?? at?.source);
      }
      return { value: false };
    }
  }
  parseIfDef(args, cs) {
    return this.macros.has(parseOneIdent(args, cs)) || this.asm.definedSymbol(parseOneIdent(args, cs));
  }
}
function sourceOfLine(line) {
  for (const t of line) {
    if (t.source)
      return t.source;
  }
  return;
}
function parseOneIdent(ts, prev) {
  const e = parseOneExpr(ts, prev);
  return identifier(e);
}
function isAddress3(expr) {
  return expr.op !== "num" || expr.meta?.rel === true || expr.meta?.org != null;
}
function parseOneExpr(ts, prev, charEncoder) {
  if (!ts.length) {
    if (!prev)
      throw new Error(`Expected expression`);
    fail(`Expected expression: ${nameOf(prev)}`, prev);
  }
  return parseOnly(ts, 0, undefined, charEncoder);
}
function noGarbage(token) {
  if (token)
    fail(`garbage at end of line: ${nameOf(token)}`, token);
}
function badClose(open, tok) {
  fail(`${name(tok)} with no ${open}`, tok);
}
function armState(outcome) {
  if ("deferred" in outcome)
    return "guessed";
  return outcome.value ? "live" : "pending";
}

// src/macpack/common.ts
var text = `
;;; Tag for labels that we expect to override vanilla
.define OVERRIDE

;;; Nicer syntax for declaring free sections
.define FREE {seg [start, end)}     .pushseg seg .eol     .org start .eol     .free end - start .eol     .popseg
.define FREE {seg [start, end]} .noexpand FREE seg [start, end + 1)


;;; Relocate a block of code and update refs
;;; Usage:
;;;   RELOCATE segments [start, end) refs...
;;; Where |segments| is an optional comma-separated list of segment
;;; names, and |refs| is a space-separated list of addresses whose
;;; contents point to |start| and that need to be updated to point to
;;; whereever it eventually ended up.  If no segments are specified
;;; then the relocation will stay within the current segment.
.define RELOCATE {seg [start, end) refs .eol} .org start .eol : FREE_UNTIL end .eol .ifnblank seg .eol .pushseg seg .eol .endif .eol .reloc .eol : .move (end-start), :-- .eol .ifnblank seg .eol .popseg .eol .endif .eol UPDATE_REFS :- @ refs

;;; Update a handful of refs to point to the given address.
;;; Usage:
;;;   UPDATE_REFS target @ refs...
;;; Where |refs| is a space-separated list of addresses, and
;;; |target| is an address or label to insert into each ref.
.define UPDATE_REFS {target @ ref refs .eol} .org ref .eol   .word (target) .eol UPDATE_REFS target @ refs
.define UPDATE_REFS {target @ .eol}


.macro FREE_UNTIL end
  .assert * <= end
  .free end - *
.endmacro

;;; Assert that |target| is the next address, documenting a deliberate
;;; fall-through into the routine that follows.
;;; Usage:
;;;   FALLTHROUGH target
.macro FALLTHROUGH target
  .assert * = target, error, "FALLTHROUGH target is not the next address"
.endmacro

`;

// src/macpack/generic.ts
var text2 = `
; Original from cc65
; This software is provided 'as-is', without any express or implied warranty.
; In no event will the authors be held liable for any damages arising from
; the use of this software.

; Permission is granted to anyone to use this software for any purpose,
; including commercial applications, and to alter it and redistribute it
; freely, subject to the following restrictions:

; 1. The origin of this software must not be misrepresented; you must not
; claim that you wrote the original software. If you use this software in
; a product, an acknowledgment in the product documentation would be
; appreciated but is not required.

; 2. Altered source versions must be plainly marked as such, and must not
; be misrepresented as being the original software.

; 3. This notice may not be removed or altered from any source distribution.


; add - Add without carry
.macro  add     Arg1, Arg2
        clc
        .if .paramcount = 2
                adc     Arg1, Arg2
        .else
                adc     Arg1
        .endif
.endmacro

; sub - subtract without borrow
.macro  sub     Arg1, Arg2
        sec
        .if .paramcount = 2
                sbc     Arg1, Arg2
        .else
                sbc     Arg1
        .endif
.endmacro

; bge - jump if unsigned greater or equal
.macro  bge     Arg
        bcs     Arg
.endmacro

; blt - Jump if unsigned less
.macro  blt     Arg
        bcc     Arg
.endmacro

; bgt - jump if unsigned greater
.macro  bgt     Arg
        .local  L
        beq     L
        bcs     Arg
L:
.endmacro

; ble - jump if unsigned less or equal
.macro  ble     Arg
        beq     Arg
        bcc     Arg
.endmacro

; bnz - jump if not zero
.macro  bnz     Arg
        bne     Arg
.endmacro

; bze - jump if zero
.macro  bze     Arg
        beq     Arg
.endmacro

`;

// src/macpack/longbranch.ts
var text3 = `
; Original from cc65
; This software is provided 'as-is', without any express or implied warranty.
; In no event will the authors be held liable for any damages arising from
; the use of this software.

; Permission is granted to anyone to use this software for any purpose,
; including commercial applications, and to alter it and redistribute it
; freely, subject to the following restrictions:

; 1. The origin of this software must not be misrepresented; you must not
; claim that you wrote the original software. If you use this software in
; a product, an acknowledgment in the product documentation would be
; appreciated but is not required.

; 2. Altered source versions must be plainly marked as such, and must not
; be misrepresented as being the original software.

; 3. This notice may not be removed or altered from any source distribution.

.macro  jeq     Target
        .if     .match(Target, 0)
        bne     *+5
        jmp     Target
        .elseif .def(Target) .and .const((*-2)-(Target)) .and ((*+2)-(Target) <= 127)
                beq     Target
        .else
                bne     *+5
                jmp     Target
        .endif
.endmacro
.macro  jne     Target
        .if     .match(Target, 0)
                beq     *+5
                jmp     Target
        .elseif .def(Target) .and .const((*-2)-(Target)) .and ((*+2)-(Target) <= 127)
                bne     Target
        .else
                beq     *+5
                jmp     Target
        .endif
.endmacro
.macro  jmi     Target
        .if     .match(Target, 0)
                bpl     *+5
                jmp     Target
        .elseif .def(Target) .and .const((*-2)-(Target)) .and ((*+2)-(Target) <= 127)
                bmi     Target
        .else
                bpl     *+5
                jmp     Target
        .endif
.endmacro
.macro  jpl     Target
        .if     .match(Target, 0)
                bmi     *+5
                jmp     Target
        .elseif .def(Target) .and .const((*-2)-(Target)) .and ((*+2)-(Target) <= 127)
                bpl     Target
        .else
                bmi     *+5
                jmp     Target
        .endif
.endmacro
.macro  jcs     Target
        .if     .match(Target, 0)
                bcc     *+5
                jmp     Target
        .elseif .def(Target) .and .const((*-2)-(Target)) .and ((*+2)-(Target) <= 127)
                bcs     Target
        .else
                bcc     *+5
                jmp     Target
        .endif
.endmacro
.macro  jcc     Target
        .if     .match(Target, 0)
                bcs     *+5
                jmp     Target
        .elseif .def(Target) .and .const((*-2)-(Target)) .and ((*+2)-(Target) <= 127)
                bcc     Target
        .else
                bcs     *+5
                jmp     Target
        .endif
.endmacro
.macro  jvs     Target
        .if     .match(Target, 0)
                bvc     *+5
                jmp     Target
        .elseif .def(Target) .and .const((*-2)-(Target)) .and ((*+2)-(Target) <= 127)
                bvs     Target
        .else
                bvc     *+5
                jmp     Target
        .endif
.endmacro
.macro  jvc     Target
        .if     .match(Target, 0)
                bvs     *+5
                jmp     Target
        .elseif .def(Target) .and .const((*-2)-(Target)) .and ((*+2)-(Target) <= 127)
                bvc     Target
        .else
                bvs     *+5
                jmp     Target
        .endif
.endmacro

`;

// src/macpack/nes2header.ts
var text4 = `
; Original from nesdev wiki: https://www.nesdev.org/wiki/NES_2.0_header_for_ca65
;
; NES 2.0 header generator for ca65 (nes2header.inc)
; 
; Copyright 2016 Damian Yerrick
; Copying and distribution of this file, with or without
; modification, are permitted in any medium without royalty provided
; the copyright notice and this notice are preserved in all source
; code copies.  This file is offered as-is, without any warranty.
;
; Modified to add a segment_name parameter for the header to nes2end

;;
; Puts ceil(log2(sz / 64)) in logsz, which should be
; local to the calling macro.  Used for NES 2 RAM sizes.
.macro _nes2_logsize sz, logsz
  .assert sz >= 0 .and sz <= 1048576, error, "RAM size must be 0 to 1048576"
  .if sz < 1
    logsz = 0
  .elseif sz <= 128
    logsz = 1
  .elseif sz <= 256
    logsz = 2
  .elseif sz <= 512
    logsz = 3
  .elseif sz <= 1024
    logsz = 4
  .elseif sz <= 2048
    logsz = 5
  .elseif sz <= 4096
    logsz = 6
  .elseif sz <= 8192
    logsz = 7
  .elseif sz <= 16384
    logsz = 8
  .elseif sz <= 32768
    logsz = 9
  .elseif sz <= 65536
    logsz = 10
  .elseif sz <= 131072
    logsz = 11
  .elseif sz <= 262144
    logsz = 12
  .elseif sz <= 524288
    logsz = 13
  .else
    logsz = 14
  .endif
.endmacro

;;
; Sets the PRG ROM size to sz bytes. Must be multiple of 16384;
; should be a power of 2.
; example: nes2prg 131072
.macro nes2prg sz
.local sz1
  sz1 = (sz) / 16384
_nes2_prgsize = <sz1
_nes2_prgsizehi = >sz1
.endmacro

;;
; Sets the CHR ROM size to sz bytes. Must be multiple of 8192;
; should be a power of 2.
; example: nes2chr 32768
.macro nes2chr sz
.local sz1
  sz1 = (sz) / 8192
_nes2_chrsize = <sz1
_nes2_chrsizehi = >sz1
.endmacro

;;
; Sets the (not battery-backed) work RAM size in bytes.
; Default is 0.
.macro nes2wram sz
.local logsz
  _nes2_logsize sz, logsz
  _nes2_wramsize = logsz
.endmacro

;;
; Sets the battery-backed work RAM size in bytes.  Default is 0.
.macro nes2bram sz
.local logsz
  _nes2_logsize sz, logsz
  _nes2_bramsize = logsz
.endmacro

;;
; Sets the (not battery-backed) CHR RAM size in bytes.  Default is 0
; if CHR ROM or battery-backed CHR RAM is defined; otherwise 8192.
.macro nes2chrram sz
.local logsz
  _nes2_logsize sz, logsz
  _nes2_chrramsize = logsz
.endmacro

;;
; Sets the battery-backed CHR RAM size in bytes.  Default is 0.
.macro nes2chrbram sz
.local logsz
  _nes2_logsize sz, logsz
  _nes2_chrbramsize = logsz
.endmacro

;;
; Sets the mirroring to one of these values:
; 'H' (horizontal mirroring, vertical arrangement)
; 'V' (vertical mirroring, horizontal arrangement)
; '4' (four-screen VRAM)
; 218 (four-screen and vertical bits on, primarily for mapper 218)
.macro nes2mirror mir
.local mi1
  mi1 = mir
  .if mi1 = 'h' .or mi1 = 'H'
    _nes2_mirror = 0
  .elseif mi1 = 'v' .or mi1 = 'V'
    _nes2_mirror = 1
  .elseif mi1 = '4'
    _nes2_mirror = 8
  .elseif mi1 = 218
    _nes2_mirror = 9
  .else
    .assert 0, error, "Mirroring mode must be 'H', 'V', or '4'"
  .endif
.endmacro

;;
; Sets the mapper (board class) ID.  For example, MMC3 is usually
; mapper 4, but TLSROM is 118 and TQROM is 119.  Some mappers have
; variants.
.macro nes2mapper mapperid, submapper
.local mi1, ms1
  mi1 = mapperid
  .assert mi1 >= 0 .and mi1 < 4096, error, "Mapper must be 0 to 4095"
  .ifnblank submapper
    .assert ms1 >= 0 .and ms1 < 16, error, "Submapper must be 0 to 15"
    ms1 = submapper
  .else
    ms1 = 0
  .endif
  _nes2_mapper6 = (mi1 & $0F) << 4
  _nes2_mapper7 = mi1 & $F0
  _nes2_mapper8 = (mi1 >> 8) | (ms1 << 4)
.endmacro

;;
; Sets the ROM's intended TV system:
; 'N' for NTSC NES/FC/PC10
; 'P' for PAL NES
; 'N','P' for dual compatible, preferring NTSC
; 'P','N' for dual compatible, preferring PAL NES
.macro nes2tv tvsystem, dual_compatible
.local tv1, tv2
  tv1 = tvsystem
  .ifnblank dual_compatible
    tv2 = $02
  .else
    tv2 = $00
  .endif
  .if tv1 = 'n' .or tv1 = 'N'
    _nes2_tvsystem = $00 | tv2
  .elseif tv1 = 'p' .or tv1 = 'P'
    _nes2_tvsystem = $01 | tv2
  .else
    .assert 0, error, "TV system must be 'N' or 'P'"
  .endif
.endmacro

;;
; Writes the header configured by previous nes2 macros.
.macro nes2end header_segment
.local battery_bit
  ; Apply defaults
  .ifndef _nes2_chrsize
    nes2chr 0
  .endif
  .ifndef _nes2_mirror
    nes2mirror 'H'
  .endif
  .ifndef _nes2_wramsize
    nes2wram 0
  .endif
  .ifndef _nes2_bramsize
    nes2bram 0
  .endif
  .ifndef _nes2_chrbramsize
    nes2chrbram 0
  .endif
  .ifndef _nes2_chrramsize
    .if _nes2_chrsize .or _nes2_chrsizehi .or _nes2_chrbramsize
      nes2chrram 0
    .else
      nes2chrram 8192
    .endif
  .endif
  .ifndef _nes2_tvsystem
    nes2tv 'N'
  .endif
  .if _nes2_bramsize .or _nes2_chrbramsize
    battery_bit = $02
  .else
    battery_bit = $00
  .endif

.pushseg
  .segment header_segment
  .byte "NES",$1A
  .byte _nes2_prgsize, _nes2_chrsize
  .byte _nes2_mapper6 | _nes2_mirror | battery_bit
  .byte _nes2_mapper7 | $08  ; not supporting vs/pc10 yet

  .byte _nes2_mapper8
  .byte (_nes2_chrsizehi << 4) | _nes2_prgsizehi
  .byte (_nes2_bramsize << 4) | _nes2_wramsize
  .byte (_nes2_chrbramsize << 4) | _nes2_chrramsize

  .byte _nes2_tvsystem, 0, 0, 0
.popseg
.endmacro

`;

// src/tokenstream.ts
var MAX_DEPTH = 256;
function searchList(dir, paths) {
  const out = [];
  const seen = new Set;
  for (const p of dir != null ? [dir, ...paths] : paths) {
    const key = joinDir("", p);
    if (seen.has(key))
      continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
var MACPACK = new Map([
  ["common", text],
  ["generic", text2],
  ["longbranch", text3],
  ["nes2header", text4]
]);

class SourceContents {
  data = new Map;
}
function newSourceLog() {
  return { text: new Map, binary: new Map, missing: [] };
}
function sourceLogKey(bases, filename) {
  return bases.join("\x00") + "\x00" + filename;
}

class TokenStream {
  resolveFile;
  resolveFileBinary;
  opts;
  sourceContents;
  errorCollector;
  sourceLog;
  stack = [];
  constructor(resolveFile, resolveFileBinary, opts, sourceContents, errorCollector, sourceLog) {
    this.resolveFile = resolveFile;
    this.resolveFileBinary = resolveFileBinary;
    this.opts = opts;
    this.sourceContents = sourceContents;
    this.errorCollector = errorCollector;
    this.sourceLog = sourceLog;
  }
  currentDir() {
    return this.stack.length ? this.stack[this.stack.length - 1].dir : undefined;
  }
  loadFile(path, bases, resolve, at, log) {
    const found = resolve(bases, path);
    if (found) {
      log?.set(sourceLogKey(bases, path), found);
      const base = bases[found.baseIndex];
      if (base === undefined) {
        fail(`Resolver returned out-of-range base index ${found.baseIndex} for ${path} ` + `(${bases.length} bases were offered)`, at);
      }
      return { content: found.content, base };
    }
    fail(`Could not find file ${path} in include directories: ${bases.join(",")}`, at);
  }
  includeSearch() {
    return searchList(this.currentDir(), this.opts?.includePaths ?? ["./"]);
  }
  binIncludeSearch() {
    const paths = this.opts?.binIncludePaths?.length ? this.opts.binIncludePaths : this.opts?.includePaths?.length ? this.opts.includePaths : [];
    return searchList(this.currentDir(), [...paths, "./"]);
  }
  get depth() {
    return this.stack.length;
  }
  next() {
    while (this.stack.length) {
      const frame = this.stack[this.stack.length - 1];
      const front = frame.queue;
      if (front.length)
        return front.pop();
      const line = frame.source?.next();
      if (line)
        return line;
      this.stack.pop();
    }
    return;
  }
  include(path, at) {
    if (!this.resolveFile) {
      fail(`Cannot read file, no reader available: ${path}`, at);
    }
    const { content: code, base } = this.loadFile(path, this.includeSearch(), this.resolveFile, at, this.sourceLog?.text);
    const resolved = joinDir(base, path);
    this.enter(new Tokenizer(code, resolved, this.opts, this.sourceContents, this.errorCollector), joinDir(base, dirOf(path)));
  }
  macpack(pack, at) {
    const code = MACPACK.get(pack);
    if (code == null)
      fail(`Unknown macpack: ${pack}`, at);
    this.enter(new Tokenizer(code, `${pack}.macpack`, this.opts, this.sourceContents, this.errorCollector));
  }
  incbin(path, offset, length, at) {
    if (!this.resolveFileBinary) {
      fail(`Cannot read binary file, no reader available: ${path}`, at);
    }
    const bases = this.binIncludeSearch();
    const loaded = this.loadFile(path, bases, this.resolveFileBinary, at);
    const bytes = typeof loaded.content === "string" ? new Base64().decode(loaded.content) : loaded.content;
    this.sourceLog?.binary.set(sourceLogKey(bases, path), { baseIndex: bases.indexOf(loaded.base), content: bytes });
    const end = length !== undefined ? offset + length : undefined;
    return new Base64().encode(bytes.slice(offset, end));
  }
  preload(path, binary) {
    const log = this.sourceLog;
    if (!log)
      return;
    const bases = binary ? this.binIncludeSearch() : this.includeSearch();
    const key = sourceLogKey(bases, path);
    const found = binary ? this.resolveFileBinary?.(bases, path) : this.resolveFile?.(bases, path);
    if (!found) {
      if (!log.missing?.includes(key))
        (log.missing ??= []).push(key);
      return;
    }
    if (!binary) {
      log.text.set(key, found);
      return;
    }
    const content = typeof found.content === "string" ? new Base64().decode(found.content) : found.content;
    log.binary.set(key, { baseIndex: found.baseIndex, content });
  }
  unshift(...lines) {
    if (!this.stack.length)
      throw new Error(`Cannot unshift after EOF`);
    const front = this.stack[this.stack.length - 1].queue;
    for (let i = lines.length - 1;i >= 0; i--) {
      front.push(lines[i]);
    }
  }
  enter(tokens, dir) {
    let frameDir = dir;
    if (frameDir == null) {
      if (this.stack.length) {
        frameDir = this.stack[this.stack.length - 1].dir;
      } else {
        const file = tokens?.file;
        frameDir = file ? dirOf(file) : "";
      }
    }
    const frame = { source: tokens, queue: [], dir: frameDir };
    this.stack.push(frame);
    if (this.stack.length > MAX_DEPTH)
      throw new Error(`Stack overflow`);
  }
  exit() {
    this.stack.pop();
  }
}

// src/assemblypass.ts
function findChunk(name, modules) {
  for (const mod of modules) {
    for (const symbol of mod.symbols ?? []) {
      if (symbol.export !== name)
        continue;
      const chunkIndex = symbol.expr?.meta?.chunk;
      if (chunkIndex == null)
        return;
      const chunk = mod.chunks?.[chunkIndex];
      if (!chunk)
        return;
      return { segments: chunk.segments, expr: symbol.expr };
    }
  }
  return;
}
function resolveCandidates(segNames, segments, pick, onDisagree) {
  let answer;
  const disagreeing = [];
  for (const segName of segNames) {
    const seg = segments.get(segName);
    if (!seg)
      continue;
    const value = pick(seg);
    if (value === undefined)
      continue;
    if (answer === undefined)
      answer = value;
    else if (value !== answer)
      disagreeing.push(segName);
  }
  if (disagreeing.length)
    onDisagree(disagreeing);
  return answer;
}
function bankOrDefault(segNames, segments, bank) {
  if (bank !== undefined || !segNames.length)
    return bank;
  return segNames.every((s) => segments.has(s)) ? 0 : undefined;
}
function resolve(name, modules, segments, pick, fallback) {
  const found = findChunk(name, modules);
  if (!found)
    return;
  const answer = resolveCandidates(found.segments, segments, pick, () => {
    fail(`${name}: disagreement across segments ${found.segments.join(", ")}`, found.expr);
  });
  return fallback ? fallback(found.segments, answer) : answer;
}
function buildLinkTimeEnv(modules, segments) {
  return {
    addrSize: (name) => resolve(name, modules, segments, (seg) => seg.addressing === 1 ? 1 : 2),
    bank: (name) => resolve(name, modules, segments, (seg) => seg.bank, (segNames, bank) => bankOrDefault(segNames, segments, bank)),
    segmentBank: (segNames) => bankOrDefault(segNames, segments, resolveCandidates(segNames, segments, (seg) => seg.bank, () => {
      fail(`disagreement across segments ${segNames.join(", ")}`);
    })),
    segmentAddrSize: (segNames) => resolveCandidates(segNames, segments, (seg) => seg.addressing === 1 ? 1 : 2, () => {
      fail(`disagreement across segments ${segNames.join(", ")}`);
    })
  };
}
function applyDefines(asm, pre, defines, opts) {
  for (const { name, value } of defines ?? []) {
    const toks = new Tokenizer(value, "<command line>", opts).next() ?? [];
    const body = toks.length && eq(toks[toks.length - 1], EOL) ? toks.slice(0, -1) : toks;
    if (body.length === 1 && body[0].token === "num") {
      asm.commandLineSet(name, body[0].num);
      continue;
    }
    if (!body.length) {
      pre.parseDefine([DEFINE, { token: "ident", str: name }]);
      continue;
    }
    pre.parseDefine([DEFINE, { token: "ident", str: name }, ...body]);
  }
}
function initialOpts(opts) {
  const tok = opts.tokenizerOptions;
  return { ...opts, tokenizerOptions: tok && { ...tok } };
}
function assembleInput(asm, input, setup, callbacks, sourceContents, signal) {
  const opts = asm.opts.tokenizerOptions ?? {};
  const lateOpts = initialOpts(asm.opts);
  const files = newSourceLog();
  if (asm.opts.generateDebugInfo)
    sourceContents ??= new SourceContents;
  const newStream = () => new TokenStream(callbacks?.resolveText, callbacks?.resolveBinary, opts, sourceContents, asm.errorCollector, files);
  const newPreprocessor = (toks) => {
    const pre = new Preprocessor(toks, asm, undefined, asm.errorCollector, setup.macroIndex, setup.inactiveRegionIndex);
    applyDefines(asm, pre, setup.defines, opts);
    return pre;
  };
  let module;
  if (input.type === "actions") {
    let moduleName = input.name;
    const runCode = (asm, code, name) => {
      const toks = newStream();
      if (moduleName === input.name && name)
        moduleName = name;
      toks.enter(new Tokenizer(code, moduleName, opts, sourceContents, asm.errorCollector));
      newPreprocessor(toks).run(signal);
    };
    runActions(asm, input.actions, runCode);
    module = asm.module();
    module.name = moduleName;
  } else {
    const toks = newStream();
    const staged = setup.stage?.(input.code, input.name);
    const code = staged ? staged.code : input.code;
    const tokenizer = new Tokenizer(code, input.name, opts, sourceContents, asm.errorCollector);
    if (staged?.usedJavascript)
      sourceContents?.data.set(input.name, input.code);
    toks.enter(tokenizer);
    newPreprocessor(toks).run(signal);
    module = asm.module();
    module.name = input.name;
    const romPatch = staged?.romPatch?.();
    if (romPatch)
      module.romPatch = romPatch;
    if (staged?.jsPost)
      module.jsPost = staged.jsPost;
    input = { type: "source", code, name: input.name };
  }
  if (module.debug)
    fillFileInfo(module, sourceContents, files, callbacks);
  const late = module.lateAssembly;
  if (late) {
    late.opts = lateOpts;
    late.input = input;
    late.files = files;
    if (setup.defines?.length)
      late.defines = setup.defines;
  }
  return module;
}
function fillFileInfo(module, sourceContents, log, callbacks) {
  const debug = module.debug;
  const known = new Set(debug.files.map((f) => f.name));
  const add = (key, baseIndex, size) => {
    const parts = key.split("\x00");
    const filename = parts.pop();
    const name = joinDir(parts[baseIndex] ?? "", filename);
    if (known.has(name))
      return;
    known.add(name);
    debug.files.push({ name, size, mtime: 0 });
  };
  for (const [key, text] of log.text)
    add(key, text.baseIndex, utf8Length(text.content));
  for (const [key, bin] of log.binary)
    add(key, bin.baseIndex, bin.content.length);
  for (const file of debug.files) {
    if (!file.size) {
      const text = sourceContents?.data.get(file.name);
      if (text !== undefined)
        file.size = utf8Length(text);
    }
    file.mtime ||= callbacks?.stat?.(file.name) ?? 0;
  }
}
function carryFileInfo(from, to) {
  const old = new Map((from.debug?.files ?? []).map((f) => [f.name, f]));
  for (const file of to.debug?.files ?? []) {
    const prev = old.get(file.name);
    if (!prev)
      continue;
    file.size = prev.size;
    file.mtime = prev.mtime;
  }
}
function sourceLogCallbacks(files) {
  const lookup = (map, bases, filename) => {
    const key = sourceLogKey(bases, filename);
    const hit = map?.get(key);
    if (!hit && files?.missing?.includes(key))
      return;
    if (!hit)
      fail(`replay needs ${filename}, which the first pass did not load`);
    return hit;
  };
  return {
    resolveText: (bases, filename) => lookup(files?.text, bases, filename),
    resolveBinary: (bases, filename) => lookup(files?.binary, bases, filename)
  };
}
function replayOpts(opts) {
  const tok = opts.tokenizerOptions ?? {};
  const jsActions = (t) => t instanceof JsActionTable ? t : undefined;
  return {
    ...opts,
    jsActions: jsActions(opts.jsActions),
    tokenizerOptions: {
      ...tok,
      jsActions: jsActions(tok.jsActions),
      lintPragmas: tok.lintPragmas instanceof LintPragmas ? tok.lintPragmas : tok.lintPragmas && new LintPragmas
    }
  };
}
function segmentsEqual(a, b) {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}
function queriedSegmentsEqual(a, b, queried) {
  for (const name of queried) {
    const x = a.get(name), y = b.get(name);
    if (!x !== !y)
      return false;
    if (x && y && !segmentsEqual(x, y))
      return false;
  }
  return true;
}
function unstableDiagnostic(a, b, queried, name) {
  const unstable = [...queried].filter((n) => !queriedSegmentsEqual(a, b, new Set([n])));
  return `${name ? `${name}: ` : ""}${unstable.map((n) => `'${n}'`).join(", ")} lands in ` + `a different segment depending on a link-time '.if' that queries it. ` + `Restructure to avoid the cycle`;
}
function replayModule(module, linkEnv, signal, options) {
  const lateAssembly = module.lateAssembly;
  if (!lateAssembly) {
    throw new Error(`replayModule: ${module.name ?? "module"} has no lateAssembly block`);
  }
  const { input, files, defines } = lateAssembly;
  if (!input) {
    throw new Error(`replayModule: ${module.name ?? "module"} has no recorded input`);
  }
  const { symbolIndex, macroIndex, inactiveRegionIndex, errorLimit } = options ?? {};
  const baseOpts = errorLimit != null ? { ...lateAssembly.opts, errorLimit } : lateAssembly.opts;
  const autoImportNames = new Set((module.autoImports ?? []).map((a) => a.name));
  const callbacks = sourceLogCallbacks(files);
  let scans = 0;
  let scanIndex;
  let scanMacros;
  let scanRegions;
  const run = (localForwardRefs, tolerant) => {
    scans++;
    scanIndex = symbolIndex && new SymbolIndex;
    scanMacros = macroIndex && new MacroIndex;
    scanRegions = inactiveRegionIndex && new InactiveRegionIndex;
    const opts = replayOpts(symbolIndex ? { ...baseOpts, symbolIndex: scanIndex } : baseOpts);
    const asm = new Assembler(Cpu.P02, opts, {
      linkEnv: linkEnv && { ...linkEnv, localForwardRefs, tolerateUnresolvedIf: tolerant },
      globalKinds: lateAssembly.globalKinds,
      autoImportNames
    });
    const scanned = assembleInput(asm, input, { defines, macroIndex: scanMacros, inactiveRegionIndex: scanRegions }, callbacks, undefined, signal);
    return { asm, scanned };
  };
  let asm;
  let replayed;
  if (lateAssembly.condQueries.length) {
    let known = new Map;
    const everQueried = new Set;
    for (let iter = 0;; iter++) {
      const { asm: scan, scanned } = run(known, true);
      const next = scan.collectLocalSegments();
      for (const name of scan.localRefQueries)
        everQueried.add(name);
      if (queriedSegmentsEqual(known, next, scan.localRefQueries)) {
        if (scan.toleratedIfs === 0) {
          asm = scan;
          replayed = scanned;
        } else {
          ({ asm, scanned: replayed } = run(next, false));
        }
        break;
      }
      if (iter >= everQueried.size) {
        fail(unstableDiagnostic(known, next, scan.localRefQueries, module.name));
      }
      known = next;
    }
  } else {
    ({ asm, scanned: replayed } = run(undefined, false));
  }
  replayed.name = module.name;
  carryFileInfo(module, replayed);
  if (module.romPatch)
    replayed.romPatch = module.romPatch;
  if (module.jsPost)
    replayed.jsPost = module.jsPost;
  if (symbolIndex && scanIndex)
    symbolIndex.adopt(scanIndex);
  if (macroIndex && scanMacros)
    macroIndex.adopt(scanMacros);
  if (inactiveRegionIndex && scanRegions)
    inactiveRegionIndex.adopt(scanRegions);
  const messages = asm.getMessages();
  const hasErrors = messages.some((m) => m.level === "error");
  return { success: !hasErrors, module: replayed, messages: [...messages], scans };
}
function needsReplay(module, linkEnv) {
  if ((module.lateAssembly?.condQueries.length ?? 0) > 0)
    return true;
  const queries = module.lateAssembly?.sizeQueries;
  if (!queries?.length)
    return false;
  return queries.some((q) => {
    const answer = linkEnv.addrSize(q.name);
    return answer !== undefined && answer !== q.guess;
  });
}
function replayModules(modules, moduleMessages, linkEnv, signal, options) {
  const collector = new ErrorCollector(options?.errorLimit);
  const outModules = [];
  const replayed = [];
  for (let i = 0;i < modules.length; i++) {
    const module = modules[i];
    collector.openAsmPass();
    if (!needsReplay(module, linkEnv)) {
      collector.merge(moduleMessages[i] ?? []);
      collector.flushAsmPass();
      outModules.push(module);
      continue;
    }
    collector.discardAsmPass();
    const replay = replayModule(module, linkEnv, signal, options);
    collector.merge(replay.messages);
    outModules.push(replay.module);
    replayed.push(i);
  }
  const messages = [...collector.getMessages()];
  return { success: !collector.hasErrors(), modules: outModules, messages, replayed };
}

// src/builder.ts
function sym(name) {
  return { op: "sym", sym: name };
}

class AsmModule {
  name;
  origin;
  actions = [];
  cursor;
  constructor(name, origin) {
    this.name = name;
    this.origin = origin;
  }
  at(line) {
    this.cursor = line;
    return this;
  }
  source() {
    if (!this.origin)
      return;
    return this.cursor == null ? this.origin : { file: this.origin.file, line: this.origin.line + this.cursor };
  }
  code(code, name) {
    this.actions.push({ action: "code", code, name, source: this.source() });
    return this;
  }
  label(label) {
    this.actions.push({ action: "label", label, source: this.source() });
    return this;
  }
  byte(bytes) {
    this.actions.push({ action: "byte", bytes: Array.isArray(bytes) ? bytes : [bytes], source: this.source() });
    return this;
  }
  word(words) {
    this.actions.push({ action: "word", words: Array.isArray(words) ? words : [words], source: this.source() });
    return this;
  }
  hibytes(values) {
    this.actions.push({ action: "hibytes", values: Array.isArray(values) ? values : [values], source: this.source() });
    return this;
  }
  lobytes(values) {
    this.actions.push({ action: "lobytes", values: Array.isArray(values) ? values : [values], source: this.source() });
    return this;
  }
  literal(values) {
    this.actions.push({ action: "literal", values: Array.isArray(values) ? values : [values], source: this.source() });
    return this;
  }
  org(addr, name) {
    this.actions.push({ action: "org", addr, name, source: this.source() });
    return this;
  }
  segment(name) {
    this.actions.push({ action: "segment", name: Array.isArray(name) ? name : [name], source: this.source() });
    return this;
  }
  reloc(name) {
    this.actions.push({ action: "reloc", name, source: this.source() });
    return this;
  }
  export(name) {
    this.actions.push({ action: "export", name, source: this.source() });
    return this;
  }
  exportzp(names) {
    this.actions.push({ action: "exportzp", names: Array.isArray(names) ? names : [names], source: this.source() });
    return this;
  }
  import(names) {
    this.actions.push({ action: "import", names: Array.isArray(names) ? names : [names], source: this.source() });
    return this;
  }
  importzp(names) {
    this.actions.push({ action: "importzp", names: Array.isArray(names) ? names : [names], source: this.source() });
    return this;
  }
  global(names) {
    this.actions.push({ action: "global", names: Array.isArray(names) ? names : [names], source: this.source() });
    return this;
  }
  globalzp(names) {
    this.actions.push({ action: "globalzp", names: Array.isArray(names) ? names : [names], source: this.source() });
    return this;
  }
  relocExportLabel(name, segments) {
    if (segments)
      this.segment(segments);
    this.reloc();
    this.label(name);
    this.export(name);
    return this;
  }
  align(boundary, fill) {
    this.actions.push({ action: "align", boundary, fill, source: this.source() });
    return this;
  }
  res(count, value) {
    this.actions.push({ action: "res", count, value, source: this.source() });
    return this;
  }
  charmap(code, target) {
    this.actions.push({ action: "charmap", code, target, source: this.source() });
    return this;
  }
  strmap(key, bytes) {
    this.actions.push({ action: "strmap", key, bytes: Array.isArray(bytes) ? bytes : [bytes], source: this.source() });
    return this;
  }
  pushCharmap() {
    this.actions.push({ action: "pushcharmap", source: this.source() });
    return this;
  }
  popCharmap() {
    this.actions.push({ action: "popcharmap", source: this.source() });
    return this;
  }
  assign(name, value) {
    this.actions.push({ action: "assign", name, value, source: this.source() });
    return this;
  }
  set(name, value) {
    this.actions.push({ action: "set", name, value, source: this.source() });
    return this;
  }
  free(size) {
    this.actions.push({ action: "free", size, source: this.source() });
    return this;
  }
}

class AsmEngine {
  options;
  modules = [];
  constructor(options = {}) {
    this.options = options;
  }
  add(mod) {
    this.modules.push(mod);
    return mod;
  }
  module(name) {
    return this.add(new AsmModule(name));
  }
  build() {
    return this.modules.map((m) => ({ type: "actions", actions: m.actions, name: m.name }));
  }
}

// src/driver/fs.ts
function parseEntry(entry) {
  return entry.endsWith("/") ? { name: entry.substring(0, entry.length - 1), dir: true } : { name: entry, dir: false };
}

// src/driver/glob.ts
var META = /[*?]/;
function isGlob(pattern) {
  return META.test(pattern);
}
function escapeLiteral(ch) {
  return /[.+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
}
function segmentSource(seg) {
  let out = "";
  for (const ch of seg) {
    if (ch === "*")
      out += "[^/]*";
    else if (ch === "?")
      out += "[^/]";
    else
      out += escapeLiteral(ch);
  }
  return out;
}
function globToRegExp(pattern) {
  const segs = toPosixPattern(pattern).split("/");
  let src = "^";
  for (let i = 0;i < segs.length; i++) {
    const seg = segs[i];
    const last = i === segs.length - 1;
    if (seg === "**") {
      if (last) {
        src += ".*";
      } else {
        src += "(?:[^/]+/)*";
        continue;
      }
    } else {
      src += segmentSource(seg);
      if (!last)
        src += "/";
    }
  }
  return new RegExp(`${src}$`);
}
function toPosixPattern(p) {
  return p.replace(/\\/g, "/");
}
function globRoot(pattern) {
  const segs = toPosixPattern(pattern).split("/");
  const lead = [];
  for (const seg of segs) {
    if (META.test(seg))
      break;
    lead.push(seg);
  }
  if (lead.length === segs.length)
    lead.pop();
  return lead.join("/");
}
function* globWalk(rootDir, pattern) {
  const posix = toPosixPattern(pattern);
  const re = globToRegExp(posix);
  const root = globRoot(posix);
  const segs = posix.split("/");
  const maxDepth = segs.includes("**") ? Infinity : segs.length;
  const out = [];
  function* visit(relDir, depth) {
    const entries = yield joinDir(rootDir, relDir) || ".";
    if (!entries)
      return;
    for (const entry of entries) {
      const { name, dir } = parseEntry(entry);
      if (name.startsWith("."))
        continue;
      const rel = relDir ? `${relDir}/${name}` : name;
      if (dir) {
        if (depth + 1 < maxDepth)
          yield* visit(rel, depth + 1);
      } else if (re.test(rel)) {
        out.push(rel);
      }
    }
  }
  yield* visit(root, root ? root.split("/").length : 0);
  return out.sort();
}
function expandGlob(list, rootDir, pattern) {
  const walk = globWalk(rootDir, pattern);
  let step = walk.next();
  while (!step.done) {
    let entries;
    try {
      entries = list(step.value);
    } catch {
      entries = null;
    }
    step = walk.next(entries);
  }
  return step.value;
}
function resolveGlob(cb, bases, pattern) {
  if (!isGlob(pattern))
    return bases.map((base) => ({ base, path: toPosixPattern(pattern) }));
  if (!cb.listDir) {
    throw new Error(`"${pattern}" needs a glob, but this frontend provides no directory listing callback.`);
  }
  const list = cb.listDir;
  const out = [];
  const seen = new Set;
  for (const base of bases.length ? bases : [""]) {
    for (const path of expandGlob(list, base, pattern)) {
      const full = joinDir(base, path);
      if (seen.has(full))
        continue;
      seen.add(full);
      out.push({ base, path });
    }
  }
  return out;
}

// src/jsmodule/bmp.generated.ts
var text5 = "const bmp =\n(()=>{function I(t){if(t instanceof ArrayBuffer)return new Uint8Array(t);return new Uint8Array(t.buffer,t.byteOffset,t.byteLength)}function w(t,e){if(!Number.isInteger(e)||e<=0)throw Error(`${t} must be a positive integer`)}var x=14,D=40,v=12;function b(t,e){return Math.floor((e*t+31)/32)*4}class P{pos=0;bytes;view;options;bottomUp=!0;dibStart=x;paletteEntrySize=4;externalMaskOffset=0;maskRed=0;maskGreen=0;maskBlue=0;maskAlpha=0;fileSize;reserved;offset;headerSize;width;height;planes;bitPP;compress;rawSize;hr;vr;colors;importantColors;palette;data;indices;constructor(t,e={}){this.bytes=I(t),this.view=new DataView(this.bytes.buffer,this.bytes.byteOffset,this.bytes.byteLength),this.options={treat16BitAs15BitAlpha:e.treat16BitAs15BitAlpha??!1,toRGBA:e.toRGBA??!1},this.parseFileHeader(),this.parseDibHeader(),this.parsePalette(),this.pos=this.offset,this.parseRGBA(),this.transformToRgbaIfNeeded()}ensureReadable(t,e,s){if(t<0||e<0||t+e>this.bytes.length)throw Error(`BMP decode out-of-range while reading ${s}`)}readUInt8(t=this.pos){if(this.ensureReadable(t,1,\"uint8\"),t===this.pos)this.pos+=1;return this.view.getUint8(t)}readUInt16LE(t=this.pos){if(this.ensureReadable(t,2,\"uint16\"),t===this.pos)this.pos+=2;return this.view.getUint16(t,!0)}readInt16LE(t=this.pos){if(this.ensureReadable(t,2,\"int16\"),t===this.pos)this.pos+=2;return this.view.getInt16(t,!0)}readUInt32LE(t=this.pos){if(this.ensureReadable(t,4,\"uint32\"),t===this.pos)this.pos+=4;return this.view.getUint32(t,!0)}readInt32LE(t=this.pos){if(this.ensureReadable(t,4,\"int32\"),t===this.pos)this.pos+=4;return this.view.getInt32(t,!0)}parseFileHeader(){if(this.ensureReadable(0,x,\"file header\"),this.bytes[0]!==66||this.bytes[1]!==77)throw Error(\"Invalid BMP file signature\");if(this.pos=2,this.fileSize=this.readUInt32LE(),this.reserved=this.readUInt32LE(),this.offset=this.readUInt32LE(),this.offset<x||this.offset>this.bytes.length)throw Error(`Invalid pixel data offset: ${this.offset}`)}parseDibHeader(){if(this.pos=this.dibStart,this.headerSize=this.readUInt32LE(),this.headerSize<v)throw Error(`Unsupported DIB header size: ${this.headerSize}`);if(this.ensureReadable(this.dibStart,this.headerSize,\"DIB header\"),this.headerSize===v){this.parseCoreHeader();return}if(this.headerSize<D)throw Error(`Unsupported DIB header size: ${this.headerSize}`);this.parseInfoHeader()}parseCoreHeader(){let t=this.readUInt16LE(this.dibStart+4),e=this.readUInt16LE(this.dibStart+6);this.width=t,this.height=e,this.planes=this.readUInt16LE(this.dibStart+8),this.bitPP=this.readUInt16LE(this.dibStart+10),this.compress=0,this.rawSize=0,this.hr=0,this.vr=0,this.colors=0,this.importantColors=0,this.bottomUp=!0,this.paletteEntrySize=3,this.externalMaskOffset=this.dibStart+this.headerSize,this.validateDimensions()}parseInfoHeader(){let t=this.readInt32LE(this.dibStart+4),e=this.readInt32LE(this.dibStart+8);if(this.width=t,this.height=e,this.planes=this.readUInt16LE(this.dibStart+12),this.bitPP=this.readUInt16LE(this.dibStart+14),this.compress=this.readUInt32LE(this.dibStart+16),this.rawSize=this.readUInt32LE(this.dibStart+20),this.hr=this.readUInt32LE(this.dibStart+24),this.vr=this.readUInt32LE(this.dibStart+28),this.colors=this.readUInt32LE(this.dibStart+32),this.importantColors=this.readUInt32LE(this.dibStart+36),this.paletteEntrySize=4,this.externalMaskOffset=this.dibStart+this.headerSize,this.height<0)this.height*=-1,this.bottomUp=!1;if(this.width<0)this.width*=-1;if(this.bitPP===16&&this.options.treat16BitAs15BitAlpha)this.bitPP=15;this.validateDimensions(),this.parseBitMasks()}validateDimensions(){if(!Number.isInteger(this.width)||!Number.isInteger(this.height)||this.width<=0||this.height<=0)throw Error(`Invalid BMP dimensions: ${this.width}x${this.height}`)}parseBitMasks(){if(!(this.bitPP===16||this.bitPP===32)||!(this.compress===3||this.compress===6))return;let t=this.dibStart+40,e=this.headerSize>=52,s=e?t:this.externalMaskOffset,i=this.compress===6||this.headerSize>=56?4:3;if(this.ensureReadable(s,i*4,\"bit masks\"),this.maskRed=this.readUInt32LE(s),this.maskGreen=this.readUInt32LE(s+4),this.maskBlue=this.readUInt32LE(s+8),this.maskAlpha=i>=4?this.readUInt32LE(s+12):0,!e)this.externalMaskOffset+=i*4}parsePalette(){if(this.bitPP>=16)return;let t=this.colors===0?1<<this.bitPP:this.colors;if(t<=0)return;let e=this.externalMaskOffset,s=t*this.paletteEntrySize;if(e+s>this.offset)throw Error(\"Palette data overlaps or exceeds pixel data offset\");this.palette=Array(t);for(let i=0;i<t;i+=1){let h=e+i*this.paletteEntrySize,n=this.readUInt8(h),r=this.readUInt8(h+1),a=this.readUInt8(h+2),o=this.paletteEntrySize===4?this.readUInt8(h+3):0;this.palette[i]={red:a,green:r,blue:n,quad:o}}}parseRGBA(){let t=this.width*this.height,e=t*4;if(this.data=new Uint8Array(e),this.bitPP===1||this.bitPP===4||this.bitPP===8)this.indices=new Uint8Array(t);switch(this.bitPP){case 1:this.bit1();return;case 4:this.bit4();return;case 8:this.bit8();return;case 15:this.bit15();return;case 16:this.bit16();return;case 24:this.bit24();return;case 32:this.bit32();return;default:throw Error(`Unsupported BMP bit depth: ${this.bitPP}`)}}transformToRgbaIfNeeded(){if(!this.options.toRGBA)return;for(let t=0;t<this.data.length;t+=4){let e=this.data[t]??0,s=this.data[t+1]??0,i=this.data[t+2]??0,h=this.data[t+3]??0;this.data[t]=h,this.data[t+1]=i,this.data[t+2]=s,this.data[t+3]=e}}getPaletteColor(t){let e=this.palette?.[t];if(e)return e;return{red:255,green:255,blue:255,quad:0}}setPixel(t,e,s,i,h,n){let r=(t*this.width+e)*4;this.data[r]=s,this.data[r+1]=i,this.data[r+2]=h,this.data[r+3]=n}setIndexedPixel(t,e,s){let i=this.getPaletteColor(s);if(this.setPixel(t,e,255,i.blue,i.green,i.red),this.indices)this.indices[t*this.width+e]=s}bit1(){let t=b(this.width,1),e=Math.ceil(this.width/8);for(let s=0;s<this.height;s+=1){let i=this.offset+s*t;this.ensureReadable(i,e,\"1-bit row\");let h=this.bottomUp?this.height-1-s:s;for(let n=0;n<this.width;n+=1){let a=this.readUInt8(i+Math.floor(n/8))>>7-n%8&1;this.setIndexedPixel(h,n,a)}}}bit4(){if(this.compress===2){this.bit4Rle();return}let t=b(this.width,4),e=Math.ceil(this.width/2);for(let s=0;s<this.height;s+=1){let i=this.offset+s*t;this.ensureReadable(i,e,\"4-bit row\");let h=this.bottomUp?this.height-1-s:s;for(let n=0;n<this.width;n+=1){let r=this.readUInt8(i+Math.floor(n/2)),a=n%2===0?(r&240)>>4:r&15;this.setIndexedPixel(h,n,a)}}}bit8(){if(this.compress===1){this.bit8Rle();return}let t=b(this.width,8),e=this.width;for(let s=0;s<this.height;s+=1){let i=this.offset+s*t;this.ensureReadable(i,e,\"8-bit row\");let h=this.bottomUp?this.height-1-s:s;for(let n=0;n<this.width;n+=1){let r=this.readUInt8(i+n);this.setIndexedPixel(h,n,r)}}}bit15(){let t=b(this.width,16),e=31;for(let s=0;s<this.height;s+=1){let i=this.offset+s*t;this.ensureReadable(i,this.width*2,\"15-bit row\");let h=this.bottomUp?this.height-1-s:s;for(let n=0;n<this.width;n+=1){let r=this.readUInt16LE(i+n*2),a=(r>>0&31)/31*255,o=(r>>5&31)/31*255,d=(r>>10&31)/31*255,l=(r&32768)!==0?255:0;this.setPixel(h,n,l,a|0,o|0,d|0)}}}scaleMasked(t,e){if(e===0)return 0;let s=0,i=0,h=e;while((h&1)===0)s+=1,h>>>=1;while((h&1)===1)i+=1,h>>>=1;let n=(t&e)>>>s;if(i>=8)return n>>>i-8;return n<<8-i&255}bit16(){if(this.maskRed===0&&this.maskGreen===0&&this.maskBlue===0)this.maskRed=31744,this.maskGreen=992,this.maskBlue=31;let t=b(this.width,16);for(let e=0;e<this.height;e+=1){let s=this.offset+e*t;this.ensureReadable(s,this.width*2,\"16-bit row\");let i=this.bottomUp?this.height-1-e:e;for(let h=0;h<this.width;h+=1){let n=this.readUInt16LE(s+h*2),r=this.scaleMasked(n,this.maskBlue),a=this.scaleMasked(n,this.maskGreen),o=this.scaleMasked(n,this.maskRed),d=this.maskAlpha!==0?this.scaleMasked(n,this.maskAlpha):255;this.setPixel(i,h,d,r,a,o)}}}bit24(){let t=b(this.width,24);for(let e=0;e<this.height;e+=1){let s=this.offset+e*t;this.ensureReadable(s,this.width*3,\"24-bit row\");let i=this.bottomUp?this.height-1-e:e;for(let h=0;h<this.width;h+=1){let n=s+h*3,r=this.readUInt8(n),a=this.readUInt8(n+1),o=this.readUInt8(n+2);this.setPixel(i,h,255,r,a,o)}}}bit32(){let t=b(this.width,32);for(let e=0;e<this.height;e+=1){let s=this.offset+e*t;this.ensureReadable(s,this.width*4,\"32-bit row\");let i=this.bottomUp?this.height-1-e:e;for(let h=0;h<this.width;h+=1){let n=s+h*4;if(this.compress===3||this.compress===6){let r=this.readUInt32LE(n),a=this.scaleMasked(r,this.maskRed||16711680),o=this.scaleMasked(r,this.maskGreen||65280),d=this.scaleMasked(r,this.maskBlue||255),l=this.maskAlpha===0?255:this.scaleMasked(r,this.maskAlpha);this.setPixel(i,h,l,d,o,a)}else{let r=this.readUInt8(n),a=this.readUInt8(n+1),o=this.readUInt8(n+2),d=this.readUInt8(n+3);this.setPixel(i,h,d,r,a,o)}}}}bit8Rle(){this.data.fill(255),this.indices?.fill(this.palette?.length??0),this.pos=this.offset;let t=0,e=this.bottomUp?this.height-1:0;while(this.pos<this.bytes.length){let s=this.readUInt8(),i=this.readUInt8();if(s===0){if(i===0){t=0,e+=this.bottomUp?-1:1;continue}if(i===1)break;if(i===2){t+=this.readUInt8(),e+=this.bottomUp?-this.readUInt8():this.readUInt8();continue}for(let h=0;h<i;h+=1){let n=this.readUInt8();if(t<this.width&&e>=0&&e<this.height)this.setIndexedPixel(e,t,n);t+=1}if((i&1)===1)this.pos+=1;continue}for(let h=0;h<s;h+=1){if(t<this.width&&e>=0&&e<this.height)this.setIndexedPixel(e,t,i);t+=1}}}bit4Rle(){this.data.fill(255),this.indices?.fill(this.palette?.length??0),this.pos=this.offset;let t=0,e=this.bottomUp?this.height-1:0;while(this.pos<this.bytes.length){let s=this.readUInt8(),i=this.readUInt8();if(s===0){if(i===0){t=0,e+=this.bottomUp?-1:1;continue}if(i===1)break;if(i===2){t+=this.readUInt8(),e+=this.bottomUp?-this.readUInt8():this.readUInt8();continue}let h=this.readUInt8();for(let n=0;n<i;n+=1){let r=n%2===0?(h&240)>>4:h&15;if(t<this.width&&e>=0&&e<this.height)this.setIndexedPixel(e,t,r);if(t+=1,n%2===1&&n+1<i)h=this.readUInt8()}if((i+1>>1&1)===1)this.pos+=1;continue}for(let h=0;h<s;h+=1){let n=h%2===0?(i&240)>>4:i&15;if(t<this.width&&e>=0&&e<this.height)this.setIndexedPixel(e,t,n);t+=1}}}getData(){return this.data}}function f(t,e){return new P(t,e)}var U=14,g=40,y=4,A=[1,4,8,16,24,32];function k(t){return A.includes(t)}function L(t){if(typeof t===\"number\"||typeof t>\"u\")return{orientation:\"top-down\",bitPP:24,palette:[]};return{orientation:t.orientation??\"top-down\",bitPP:t.bitPP??24,palette:t.palette??[]}}class E{pixelData;width;height;options;palette;exactPaletteIndex=new Map;constructor(t,e){if(this.pixelData=t.data,this.width=t.width,this.height=t.height,this.options=e,this.palette=this.normalizePalette(e),w(\"width\",this.width),w(\"height\",this.height),!k(this.options.bitPP))throw Error(`Unsupported encode bit depth: ${this.options.bitPP}. Supported: 1, 4, 8, 16, 24, 32.`);let s=this.width*this.height*y;if(this.pixelData.length<s)throw Error(`Image data is too short: expected at least ${s} bytes for ${this.width}x${this.height} ABGR data.`);for(let i=0;i<this.palette.length;i+=1){let h=this.palette[i],n=this.paletteKey(h.quad,h.blue,h.green,h.red);if(!this.exactPaletteIndex.has(n))this.exactPaletteIndex.set(n,i)}}normalizePalette(t){if(t.bitPP===1){let e=t.palette.length?t.palette:[{red:255,green:255,blue:255,quad:0},{red:0,green:0,blue:0,quad:0}];return this.validatePalette(t.bitPP,e),e}if(t.bitPP===4||t.bitPP===8){if(t.palette.length===0)throw Error(`Encoding ${t.bitPP}-bit BMP requires a non-empty palette.`);return this.validatePalette(t.bitPP,t.palette),t.palette}return[]}validatePalette(t,e){let s=1<<t;if(e.length===0||e.length>s)throw Error(`Palette size ${e.length} is invalid for ${t}-bit BMP. Expected 1..${s}.`);for(let i of e)this.validateChannel(\"palette.red\",i.red),this.validateChannel(\"palette.green\",i.green),this.validateChannel(\"palette.blue\",i.blue),this.validateChannel(\"palette.quad\",i.quad)}validateChannel(t,e){if(!Number.isInteger(e)||e<0||e>255)throw Error(`${t} must be an integer between 0 and 255.`)}rowStride(){return Math.floor((this.options.bitPP*this.width+31)/32)*4}sourceY(t){return this.options.orientation===\"top-down\"?t:this.height-1-t}sourceOffset(t,e){return(e*this.width+t)*y}paletteKey(t,e,s,i){return((t&255)<<24|(e&255)<<16|(s&255)<<8|i&255)>>>0}findPaletteIndex(t,e,s,i){let h=this.exactPaletteIndex.get(this.paletteKey(t,e,s,i));if(h!==void 0)return h;let n=0,r=Number.POSITIVE_INFINITY;for(let a=0;a<this.palette.length;a+=1){let o=this.palette[a],d=o.red-i,l=o.green-s,c=o.blue-e,p=o.quad-t,u=d*d+l*l+c*c+p*p;if(u<r)r=u,n=a}return n}writePalette(t,e){for(let s=0;s<this.palette.length;s+=1){let i=this.palette[s],h=e+s*4;t[h]=i.blue,t[h+1]=i.green,t[h+2]=i.red,t[h+3]=i.quad}}encode1Bit(t,e,s){for(let i=0;i<this.height;i+=1){let h=this.sourceY(i),n=e+i*s;for(let r=0;r<this.width;r+=8){let a=0;for(let o=0;o<8;o+=1){let d=r+o;if(d>=this.width)break;let l=this.sourceOffset(d,h),c=this.pixelData[l]??255,p=this.pixelData[l+1]??0,u=this.pixelData[l+2]??0,R=this.pixelData[l+3]??0,S=this.findPaletteIndex(c,p,u,R)&1;a|=S<<7-o}t[n+Math.floor(r/8)]=a}}}encode4Bit(t,e,s){for(let i=0;i<this.height;i+=1){let h=this.sourceY(i),n=e+i*s;for(let r=0;r<this.width;r+=2){let a=this.sourceOffset(r,h),o=this.findPaletteIndex(this.pixelData[a]??255,this.pixelData[a+1]??0,this.pixelData[a+2]??0,this.pixelData[a+3]??0),d=0;if(r+1<this.width){let l=this.sourceOffset(r+1,h);d=this.findPaletteIndex(this.pixelData[l]??255,this.pixelData[l+1]??0,this.pixelData[l+2]??0,this.pixelData[l+3]??0)}t[n+Math.floor(r/2)]=(o&15)<<4|d&15}}}encode8Bit(t,e,s){for(let i=0;i<this.height;i+=1){let h=this.sourceY(i),n=e+i*s;for(let r=0;r<this.width;r+=1){let a=this.sourceOffset(r,h);t[n+r]=this.findPaletteIndex(this.pixelData[a]??255,this.pixelData[a+1]??0,this.pixelData[a+2]??0,this.pixelData[a+3]??0)}}}encode16Bit(t,e,s,i){for(let h=0;h<this.height;h+=1){let n=this.sourceY(h),r=s+h*i;for(let a=0;a<this.width;a+=1){let o=this.sourceOffset(a,n),d=this.pixelData[o+1]??0,l=this.pixelData[o+2]??0,p=((this.pixelData[o+3]??0)>>3&31)<<10|(l>>3&31)<<5|d>>3&31;e.setUint16(r+a*2,p,!0)}}}encode24Bit(t,e,s){for(let i=0;i<this.height;i+=1){let h=this.sourceY(i),n=e+i*s;for(let r=0;r<this.width;r+=1){let a=this.sourceOffset(r,h),o=n+r*3;t[o]=this.pixelData[a+1]??0,t[o+1]=this.pixelData[a+2]??0,t[o+2]=this.pixelData[a+3]??0}}}encode32Bit(t,e,s){for(let i=0;i<this.height;i+=1){let h=this.sourceY(i),n=e+i*s;for(let r=0;r<this.width;r+=1){let a=this.sourceOffset(r,h),o=n+r*4;t[o]=this.pixelData[a+1]??0,t[o+1]=this.pixelData[a+2]??0,t[o+2]=this.pixelData[a+3]??0,t[o+3]=this.pixelData[a]??255}}}encode(){let t=this.rowStride(),e=t*this.height,s=this.palette.length*4,i=U+g+s,h=i+e,n=new Uint8Array(h),r=new DataView(n.buffer,n.byteOffset,n.byteLength);n[0]=66,n[1]=77,r.setUint32(2,h,!0),r.setUint32(6,0,!0),r.setUint32(10,i,!0),r.setUint32(14,g,!0),r.setInt32(18,this.width,!0);let a=this.options.orientation===\"top-down\"?-this.height:this.height;if(r.setInt32(22,a,!0),r.setUint16(26,1,!0),r.setUint16(28,this.options.bitPP,!0),r.setUint32(30,0,!0),r.setUint32(34,e,!0),r.setUint32(38,0,!0),r.setUint32(42,0,!0),r.setUint32(46,this.palette.length,!0),r.setUint32(50,0,!0),this.palette.length>0)this.writePalette(n,U+g);switch(this.options.bitPP){case 1:this.encode1Bit(n,i,t);break;case 4:this.encode4Bit(n,i,t);break;case 8:this.encode8Bit(n,i,t);break;case 16:this.encode16Bit(n,r,i,t);break;case 24:this.encode24Bit(n,i,t);break;case 32:this.encode32Bit(n,i,t);break}return n}}function m(t,e){let s=L(e);return{data:new E(t,s).encode(),width:t.width,height:t.height}}function O(t){return[t.red,t.green,t.blue]}function M([t,e,s]){return{red:t,green:e,blue:s,quad:0}}function B(t){if(!t.length)throw Error(\"bmp: palette is empty\");for(let[e,s]of t.entries()){if(!Array.isArray(s)||s.length!==3)throw Error(`bmp: palette[${e}] is not an [r, g, b] triple`);for(let i of s)if(!Number.isInteger(i)||i<0||i>255)throw Error(`bmp: palette[${e}] has a channel outside 0-255: ${s.join()}`)}}function z(t,e,s,i){let h=new Map;for(let r=s.length-1;r>=0;r--){let[a,o,d]=s[r];h.set(a<<16|o<<8|d,r)}let n=new Uint8Array(t.length/4);for(let r=0;r<n.length;r++){let a=t[r*4],o=t[r*4+1],d=t[r*4+2],l=h.get(a<<16|o<<8|d);if(l!==void 0){n[r]=l;continue}if(i){let c=r%e,p=(r-c)/e;throw Error(`bmp: color rgb(${a}, ${o}, ${d}) at (${c}, ${p}) is not in the palette. Pass {exact: false} to take the nearest match instead.`)}n[r]=C(a,o,d,s)}return n}function C(t,e,s,i){let h=0,n=1/0;for(let r=0;r<i.length;r++){let[a,o,d]=i[r],l=(t-a)**2+(e-o)**2+(s-d)**2;if(l<n)n=l,h=r}return h}function Y(t){let e=new Uint8Array(t.length);for(let s=0;s<t.length;s+=4)e[s]=t[s+3],e[s+1]=t[s+2],e[s+2]=t[s+1],e[s+3]=t[s];return e}function H(t){let e=f(t,{toRGBA:!0});return{width:e.width,height:e.height,data:e.data}}function _(t,e={}){let s=f(t,{toRGBA:!0}),{width:i,height:h}=s;if(s.indices&&s.palette){let r=s.palette.map(O),a=s.indices.indexOf(r.length);if(a>=0){let o=a%i,d=(a-o)/i;throw Error(`bmp: the RLE data leaves the pixel at (${o}, ${d}) undefined, so it has no palette index`)}return{width:i,height:h,pixels:s.indices,palette:r}}if(!e.palette)throw Error(`bmp: this is a ${s.bitPP}-bit image with no palette of its own, so .load needs one: bmp.load(bytes, {palette: [[r, g, b], ...]})`);B(e.palette);let n=e.palette.map((r)=>[...r]);return{width:i,height:h,palette:n,pixels:z(s.data,i,n,e.exact!==!1)}}function G(t,e={}){let{width:s,height:i}=t,h=e.palette??(\"palette\"in t?t.palette:void 0),n;if(\"pixels\"in t){if(!h)throw Error(\"bmp.encode: an indexed image needs a palette\");B(h),n=new Uint8Array(s*i*4);for(let a=0;a<t.pixels.length;a++){let o=h[t.pixels[a]];if(!o)throw Error(`bmp.encode: pixel ${a} has index ${t.pixels[a]}, outside a palette of ${h.length}`);n[a*4]=o[0],n[a*4+1]=o[1],n[a*4+2]=o[2],n[a*4+3]=255}}else n=t.data;let r=e.bits??(h?8:24);return m({data:Y(n),width:s,height:i},{bitPP:r,palette:h?.map(M)??[]}).data}return{load:_,loadRgba:H,encode:G,lib:{decode:f,encode:m}};})();";

// src/jsmodule/png.generated.ts
var text6 = `const png =
(()=>{var ir=function(){var G={nextZero:function(e,o){while(e[o]!=0)o++;return o},readUshort:function(e,o){return e[o]<<8|e[o+1]},writeUshort:function(e,o,w){e[o]=w>>8&255,e[o+1]=w&255},readUint:function(e,o){return e[o]*16777216+(e[o+1]<<16|e[o+2]<<8|e[o+3])},writeUint:function(e,o,w){e[o]=w>>24&255,e[o+1]=w>>16&255,e[o+2]=w>>8&255,e[o+3]=w&255},readASCII:function(e,o,w){var U="";for(var C=0;C<w;C++)U+=String.fromCharCode(e[o+C]);return U},writeASCII:function(e,o,w){for(var U=0;U<w.length;U++)e[o+U]=w.charCodeAt(U)},readBytes:function(e,o,w){var U=[];for(var C=0;C<w;C++)U.push(e[o+C]);return U},pad:function(e){return e.length<2?"0"+e:e},readUTF8:function(e,o,w){var U="",C;for(var S=0;S<w;S++)U+="%"+G.pad(e[o+S].toString(16));try{C=decodeURIComponent(U)}catch(A){return G.readASCII(e,o,w)}return C}};function F(e){var{width:o,height:w}=e;if(e.tabs.acTL==null)return[k(e.data,o,w,e).buffer];var U=[];if(e.frames[0].data==null)e.frames[0].data=e.data;var C=o*w*4,S=new Uint8Array(C),A=new Uint8Array(C),N=new Uint8Array(C);for(var Z=0;Z<e.frames.length;Z++){var Y=e.frames[Z],M=Y.rect.x,H=Y.rect.y,u=Y.rect.width,g=Y.rect.height,l=k(Y.data,u,g,e);if(Z!=0)for(var R=0;R<C;R++)N[R]=S[R];if(Y.blend==0)ur(l,u,g,S,o,w,M,H,0);else if(Y.blend==1)ur(l,u,g,S,o,w,M,H,1);if(U.push(S.buffer.slice(0)),Y.dispose==0);else if(Y.dispose==1)ur(A,u,g,S,o,w,M,H,0);else if(Y.dispose==2)for(var R=0;R<C;R++)S[R]=N[R]}return U}function k(e,o,w,U){var C=o*w,S=nr(U),A=Math.ceil(o*S/8),N=new Uint8Array(C*4),Z=new Uint32Array(N.buffer),{ctype:Y,depth:M}=U,H=G.readUshort,u=Date.now();if(Y==6){var g=C<<2;if(M==8)for(var l=0;l<g;l+=4)N[l]=e[l],N[l+1]=e[l+1],N[l+2]=e[l+2],N[l+3]=e[l+3];if(M==16)for(var l=0;l<g;l++)N[l]=e[l<<1]}else if(Y==2){var R=U.tabs.tRNS;if(R==null){if(M==8)for(var l=0;l<C;l++){var P=l*3;Z[l]=-16777216|e[P+2]<<16|e[P+1]<<8|e[P]}if(M==16)for(var l=0;l<C;l++){var P=l*6;Z[l]=-16777216|e[P+4]<<16|e[P+2]<<8|e[P]}}else{var B=R[0],L=R[1],O=R[2];if(M==8)for(var l=0;l<C;l++){var T=l<<2,P=l*3;if(Z[l]=-16777216|e[P+2]<<16|e[P+1]<<8|e[P],e[P]==B&&e[P+1]==L&&e[P+2]==O)N[T+3]=0}if(M==16)for(var l=0;l<C;l++){var T=l<<2,P=l*6;if(Z[l]=-16777216|e[P+4]<<16|e[P+2]<<8|e[P],H(e,P)==B&&H(e,P+2)==L&&H(e,P+4)==O)N[T+3]=0}}}else if(Y==3){var K=U.tabs.PLTE,r=U.tabs.tRNS,n=r?r.length:0;if(M==1)for(var i=0;i<w;i++){var s=i*A,v=i*o;for(var l=0;l<o;l++){var T=v+l<<2,h=e[s+(l>>3)]>>7-((l&7)<<0)&1,f=3*h;N[T]=K[f],N[T+1]=K[f+1],N[T+2]=K[f+2],N[T+3]=h<n?r[h]:255}}if(M==2)for(var i=0;i<w;i++){var s=i*A,v=i*o;for(var l=0;l<o;l++){var T=v+l<<2,h=e[s+(l>>2)]>>6-((l&3)<<1)&3,f=3*h;N[T]=K[f],N[T+1]=K[f+1],N[T+2]=K[f+2],N[T+3]=h<n?r[h]:255}}if(M==4)for(var i=0;i<w;i++){var s=i*A,v=i*o;for(var l=0;l<o;l++){var T=v+l<<2,h=e[s+(l>>1)]>>4-((l&1)<<2)&15,f=3*h;N[T]=K[f],N[T+1]=K[f+1],N[T+2]=K[f+2],N[T+3]=h<n?r[h]:255}}if(M==8)for(var l=0;l<C;l++){var T=l<<2,h=e[l],f=3*h;N[T]=K[f],N[T+1]=K[f+1],N[T+2]=K[f+2],N[T+3]=h<n?r[h]:255}}else if(Y==4){if(M==8)for(var l=0;l<C;l++){var T=l<<2,c=l<<1,t=e[c];N[T]=t,N[T+1]=t,N[T+2]=t,N[T+3]=e[c+1]}if(M==16)for(var l=0;l<C;l++){var T=l<<2,c=l<<2,t=e[c];N[T]=t,N[T+1]=t,N[T+2]=t,N[T+3]=e[c+2]}}else if(Y==0){var B=U.tabs.tRNS?U.tabs.tRNS:-1;for(var i=0;i<w;i++){var a=i*A,b=i*o;if(M==1)for(var _=0;_<o;_++){var t=255*(e[a+(_>>>3)]>>>7-(_&7)&1),y=t==B*255?0:255;Z[b+_]=y<<24|t<<16|t<<8|t}else if(M==2)for(var _=0;_<o;_++){var t=85*(e[a+(_>>>2)]>>>6-((_&3)<<1)&3),y=t==B*85?0:255;Z[b+_]=y<<24|t<<16|t<<8|t}else if(M==4)for(var _=0;_<o;_++){var t=17*(e[a+(_>>>1)]>>>4-((_&1)<<2)&15),y=t==B*17?0:255;Z[b+_]=y<<24|t<<16|t<<8|t}else if(M==8)for(var _=0;_<o;_++){var t=e[a+_],y=t==B?0:255;Z[b+_]=y<<24|t<<16|t<<8|t}else if(M==16)for(var _=0;_<o;_++){var t=e[a+(_<<1)],y=H(e,a+(_<<1))==B?0:255;Z[b+_]=y<<24|t<<16|t<<8|t}}}return N}function V(e){var o=new Uint8Array(e),w=8,U=G,{readUshort:C,readUint:S}=U,A={tabs:{},frames:[]},N=new Uint8Array(o.length),Z=0,Y,M=0,H=[137,80,78,71,13,10,26,10];for(var u=0;u<8;u++)if(o[u]!=H[u])throw"The input is not a PNG file!";while(w<o.length){var g=U.readUint(o,w);w+=4;var l=U.readASCII(o,w,4);if(w+=4,l=="IHDR")er(o,w,A);else if(l=="iCCP"){var R=w;while(o[R]!=0)R++;var P=U.readASCII(o,w,R-w),B=o[R+1],L=o.slice(R+2,w+g),O=null;try{O=J(L)}catch(I){O=z(L)}A.tabs[l]=O}else if(l=="CgBI")A.tabs[l]=o.slice(w,w+4);else if(l=="IDAT"){for(var u=0;u<g;u++)N[Z+u]=o[w+u];Z+=g}else if(l=="acTL")A.tabs[l]={num_frames:S(o,w),num_plays:S(o,w+4)},Y=new Uint8Array(o.length);else if(l=="fcTL"){if(M!=0){var T=A.frames[A.frames.length-1];T.data=j(A,Y.slice(0,M),T.rect.width,T.rect.height),M=0}var K={x:S(o,w+12),y:S(o,w+16),width:S(o,w+4),height:S(o,w+8)},r=C(o,w+22);r=C(o,w+20)/(r==0?100:r);var n={rect:K,delay:Math.round(r*1000),dispose:o[w+24],blend:o[w+25]};A.frames.push(n)}else if(l=="fdAT"){for(var u=0;u<g-4;u++)Y[M+u]=o[w+u+4];M+=g-4}else if(l=="pHYs")A.tabs[l]=[U.readUint(o,w),U.readUint(o,w+4),o[w+8]];else if(l=="cHRM"){A.tabs[l]=[];for(var u=0;u<8;u++)A.tabs[l].push(U.readUint(o,w+u*4))}else if(l=="tEXt"||l=="zTXt"){if(A.tabs[l]==null)A.tabs[l]={};var i=U.nextZero(o,w),s=U.readASCII(o,w,i-w),v,h=w+g-i-1;if(l=="tEXt")v=U.readASCII(o,i+1,h);else{var f=J(o.slice(i+2,i+2+h));v=U.readUTF8(f,0,f.length)}A.tabs[l][s]=v}else if(l=="iTXt"){if(A.tabs[l]==null)A.tabs[l]={};var i=0,R=w;i=U.nextZero(o,R);var s=U.readASCII(o,R,i-R);R=i+1;var c=o[R],t=o[R+1];R+=2,i=U.nextZero(o,R);var a=U.readASCII(o,R,i-R);R=i+1,i=U.nextZero(o,R);var b=U.readUTF8(o,R,i-R);R=i+1;var v,h=g-(R-w);if(c==0)v=U.readUTF8(o,R,h);else{var f=J(o.slice(R,R+h));v=U.readUTF8(f,0,f.length)}A.tabs[l][s]=v}else if(l=="PLTE")A.tabs[l]=U.readBytes(o,w,g);else if(l=="hIST"){var _=A.tabs.PLTE.length/3;A.tabs[l]=[];for(var u=0;u<_;u++)A.tabs[l].push(C(o,w+u*2))}else if(l=="tRNS"){if(A.ctype==3)A.tabs[l]=U.readBytes(o,w,g);else if(A.ctype==0)A.tabs[l]=C(o,w);else if(A.ctype==2)A.tabs[l]=[C(o,w),C(o,w+2),C(o,w+4)]}else if(l=="gAMA")A.tabs[l]=U.readUint(o,w)/1e5;else if(l=="sRGB")A.tabs[l]=o[w];else if(l=="bKGD"){if(A.ctype==0||A.ctype==4)A.tabs[l]=[C(o,w)];else if(A.ctype==2||A.ctype==6)A.tabs[l]=[C(o,w),C(o,w+2),C(o,w+4)];else if(A.ctype==3)A.tabs[l]=o[w]}else if(l=="IEND")break;w+=g;var y=U.readUint(o,w);w+=4}if(M!=0){var T=A.frames[A.frames.length-1];T.data=j(A,Y.slice(0,M),T.rect.width,T.rect.height)}return A.data=j(A,N,A.width,A.height),delete A.compress,delete A.interlace,delete A.filter,A}function j(e,o,w,U){var N=Date.now(),C=nr(e),S=Math.ceil(w*C/8),A=new Uint8Array((S+1+e.interlace)*U);if(e.tabs.CgBI)o=z(o,A);else o=J(o,A);var N=Date.now();if(e.interlace==0)o=or(o,e,0,w,U);else if(e.interlace==1)o=rr(o,e);return o}function J(e,o){var w=z(new Uint8Array(e.buffer,2,e.length-6),o);return w}var z=function(){var e=function(){var u=Uint16Array,g=Uint32Array;return{m:new u(16),v:new u(16),d:[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],o:[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,999,999,999],z:[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0],B:new u(32),p:[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,65535,65535],w:[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0],h:new g(32),g:new u(512),s:[],A:new u(32),t:[],k:new u(32768),c:[],a:[],n:new u(32768),e:[],C:new u(512),b:[],i:new u(32768),r:new g(286),f:new g(30),l:new g(19),u:new g(15000),q:new u(65536),j:new u(32768)}}();function o(u,g){var l=u.length,R,P,B,L,O,T=e.v;for(var L=0;L<=g;L++)T[L]=0;for(L=1;L<l;L+=2)T[u[L]]++;var K=e.m;R=0,T[0]=0;for(P=1;P<=g;P++)R=R+T[P-1]<<1,K[P]=R;for(B=0;B<l;B+=2)if(O=u[B+1],O!=0)u[B]=K[O],K[O]++}function w(u,g,l){var R=u.length,P=e.i;for(var B=0;B<R;B+=2)if(u[B+1]!=0){var L=B>>1,O=u[B+1],T=L<<4|O,K=g-O,r=u[B]<<K,n=r+(1<<K);while(r!=n){var i=P[r]>>>15-g;l[i]=T,r++}}}function U(u,g){var l=e.i,R=15-g;for(var P=0;P<u.length;P+=2){var B=u[P]<<g-u[P+1];u[P]=l[B]>>>R}}(function(){var u=32768;for(var g=0;g<u;g++){var l=g;l=(l&2863311530)>>>1|(l&1431655765)<<1,l=(l&3435973836)>>>2|(l&858993459)<<2,l=(l&4042322160)>>>4|(l&252645135)<<4,l=(l&4278255360)>>>8|(l&16711935)<<8,e.i[g]=(l>>>16|l<<16)>>>17}function R(P,B,L){while(B--!=0)P.push(0,L)}for(var g=0;g<32;g++)e.B[g]=e.o[g]<<3|e.z[g],e.h[g]=e.p[g]<<4|e.w[g];R(e.s,144,8),R(e.s,112,9),R(e.s,24,7),R(e.s,8,8),o(e.s,9),w(e.s,9,e.g),U(e.s,9),R(e.t,32,5),o(e.t,5),w(e.t,5,e.A),U(e.t,5),R(e.b,19,0),R(e.c,286,0),R(e.e,30,0),R(e.a,320,0)})();function C(u,g,l){return(u[g>>>3]|u[(g>>>3)+1]<<8)>>>(g&7)&(1<<l)-1}function S(u,g,l){return(u[g>>>3]|u[(g>>>3)+1]<<8|u[(g>>>3)+2]<<16)>>>(g&7)&(1<<l)-1}function A(u,g){return(u[g>>>3]|u[(g>>>3)+1]<<8|u[(g>>>3)+2]<<16)>>>(g&7)}function N(u,g){return(u[g>>>3]|u[(g>>>3)+1]<<8|u[(g>>>3)+2]<<16|u[(g>>>3)+3]<<24)>>>(g&7)}function Z(u,g){var l=Uint8Array,R=0,P=0,B=0,L=0,O=0,T=0,K=0,r=0,n=0,i,s;if(u[0]==3&&u[1]==0)return g?g:new l(0);var v=g==null;if(v)g=new l(u.length>>>2<<3);while(R==0){if(R=S(u,n,1),P=S(u,n+1,2),n+=3,P==0){if((n&7)!=0)n+=8-(n&7);var h=(n>>>3)+4,f=u[h-4]|u[h-3]<<8;if(v)g=Y(g,r+f);g.set(new l(u.buffer,u.byteOffset+h,f),r),n=h+f<<3,r+=f;continue}if(v)g=Y(g,r+131072);if(P==1)i=e.g,s=e.A,T=511,K=31;if(P==2){B=C(u,n,5)+257,L=C(u,n+5,5)+1,O=C(u,n+10,4)+4,n+=14;var c=n,t=1;for(var a=0;a<38;a+=2)e.b[a]=0,e.b[a+1]=0;for(var a=0;a<O;a++){var b=C(u,n+a*3,3);if(e.b[(e.d[a]<<1)+1]=b,b>t)t=b}n+=3*O,o(e.b,t),w(e.b,t,e.C),i=e.k,s=e.n,n=M(e.C,(1<<t)-1,B+L,u,n,e.a);var _=H(e.a,0,B,e.c);T=(1<<_)-1;var y=H(e.a,B,L,e.e);K=(1<<y)-1,o(e.c,_),w(e.c,_,i),o(e.e,y),w(e.e,y,s)}while(!0){var I=i[A(u,n)&T];n+=I&15;var p=I>>>4;if(p>>>8==0)g[r++]=p;else if(p==256)break;else{var E=r+p-254;if(p>264){var D=e.B[p-257];E=r+(D>>>3)+C(u,n,D&7),n+=D&7}var x=s[A(u,n)&K];n+=x&15;var d=x>>>4,m=e.h[d],q=(m>>>4)+S(u,n,m&15);if(n+=m&15,v)g=Y(g,r+131072);while(r<E)g[r]=g[r++-q],g[r]=g[r++-q],g[r]=g[r++-q],g[r]=g[r++-q];r=E}}}return g.length==r?g:g.slice(0,r)}function Y(u,g){var l=u.length;if(g<=l)return u;var R=new Uint8Array(Math.max(l<<1,g));return R.set(u,0),R}function M(u,g,l,R,P,B){var L=0;while(L<l){var O=u[A(R,P)&g];P+=O&15;var T=O>>>4;if(T<=15)B[L]=T,L++;else{var K=0,r=0;if(T==16)r=3+C(R,P,2),P+=2,K=B[L-1];else if(T==17)r=3+C(R,P,3),P+=3;else if(T==18)r=11+C(R,P,7),P+=7;var n=L+r;while(L<n)B[L]=K,L++}}return P}function H(u,g,l,R){var P=0,B=0,L=R.length>>>1;while(B<l){var O=u[B+g];if(R[B<<1]=0,R[(B<<1)+1]=O,O>P)P=O;B++}while(B<L)R[B<<1]=0,R[(B<<1)+1]=0,B++;return P}return Z}();function rr(e,o){var{width:w,height:U}=o,C=nr(o),S=C>>3,A=Math.ceil(w*C/8),N=new Uint8Array(U*A),Z=0,Y=[0,0,4,0,2,0,1],M=[0,4,0,2,0,1,0],H=[8,8,8,4,4,2,2],u=[8,8,4,4,2,2,1],g=0;while(g<7){var l=H[g],R=u[g],P=0,B=0,L=Y[g];while(L<U)L+=l,B++;var O=M[g];while(O<w)O+=R,P++;var T=Math.ceil(P*C/8);or(e,o,Z,P,B);var K=0,r=Y[g];while(r<U){var n=M[g],i=Z+K*T<<3;while(n<w){if(C==1){var s=e[i>>3];s=s>>7-(i&7)&1,N[r*A+(n>>3)]|=s<<7-((n&7)<<0)}if(C==2){var s=e[i>>3];s=s>>6-(i&7)&3,N[r*A+(n>>2)]|=s<<6-((n&3)<<1)}if(C==4){var s=e[i>>3];s=s>>4-(i&7)&15,N[r*A+(n>>1)]|=s<<4-((n&1)<<2)}if(C>=8){var v=r*A+n*S;for(var h=0;h<S;h++)N[v+h]=e[(i>>3)+h]}i+=C,n+=R}K++,r+=l}if(P*B!=0)Z+=B*(1+T);g=g+1}return N}function nr(e){var o=[1,null,3,1,2,null,4][e.ctype];return o*e.depth}function or(e,o,w,U,C){var S=nr(o),A=Math.ceil(U*S/8);S=Math.ceil(S/8);var N,Z,Y=e[w],M=0;if(Y>1)e[w]=[0,0,1][Y-2];if(Y==3)for(M=S;M<A;M++)e[M+1]=e[M+1]+(e[M+1-S]>>>1)&255;for(var H=0;H<C;H++)if(N=w+H*A,Z=N+H+1,Y=e[Z-1],M=0,Y==0)for(;M<A;M++)e[N+M]=e[Z+M];else if(Y==1){for(;M<S;M++)e[N+M]=e[Z+M];for(;M<A;M++)e[N+M]=e[Z+M]+e[N+M-S]}else if(Y==2)for(;M<A;M++)e[N+M]=e[Z+M]+e[N+M-A];else if(Y==3){for(;M<S;M++)e[N+M]=e[Z+M]+(e[N+M-A]>>>1);for(;M<A;M++)e[N+M]=e[Z+M]+(e[N+M-A]+e[N+M-S]>>>1)}else{for(;M<S;M++)e[N+M]=e[Z+M]+hr(0,e[N+M-A],0);for(;M<A;M++)e[N+M]=e[Z+M]+hr(e[N+M-S],e[N+M-A],e[N+M-S-A])}return e}function hr(e,o,w){var U=e+o-w,C=U-e,S=U-o,A=U-w;if(C*C<=S*S&&C*C<=A*A)return e;else if(S*S<=A*A)return o;return w}function er(e,o,w){w.width=G.readUint(e,o),o+=4,w.height=G.readUint(e,o),o+=4,w.depth=e[o],o++,w.ctype=e[o],o++,w.compress=e[o],o++,w.filter=e[o],o++,w.interlace=e[o],o++}function ur(e,o,w,U,C,S,A,N,Z){var Y=Math.min(o,C),M=Math.min(w,S),H=0,u=0;for(var g=0;g<M;g++)for(var l=0;l<Y;l++){if(A>=0&&N>=0)H=g*o+l<<2,u=(N+g)*C+A+l<<2;else H=(-N+g)*o-A+l<<2,u=g*C+l<<2;if(Z==0)U[u]=e[H],U[u+1]=e[H+1],U[u+2]=e[H+2],U[u+3]=e[H+3];else if(Z==1){var R=e[H+3]*0.00392156862745098,P=e[H]*R,B=e[H+1]*R,L=e[H+2]*R,O=U[u+3]*0.00392156862745098,T=U[u]*O,K=U[u+1]*O,r=U[u+2]*O,n=1-R,i=R+O*n,s=i==0?0:1/i;U[u+3]=255*i,U[u+0]=(P+T*n)*s,U[u+1]=(B+K*n)*s,U[u+2]=(L+r*n)*s}else if(Z==2){var R=e[H+3],P=e[H],B=e[H+1],L=e[H+2],O=U[u+3],T=U[u],K=U[u+1],r=U[u+2];if(R==O&&P==T&&B==K&&L==r)U[u]=0,U[u+1]=0,U[u+2]=0,U[u+3]=0;else U[u]=P,U[u+1]=B,U[u+2]=L,U[u+3]=R}else if(Z==3){var R=e[H+3],P=e[H],B=e[H+1],L=e[H+2],O=U[u+3],T=U[u],K=U[u+1],r=U[u+2];if(R==O&&P==T&&B==K&&L==r)continue;if(R<220&&O>20)return!1}}return!0}return{decode:V,toRGBA8:F,_paeth:hr,_copyTile:ur,_bin:G}}();(function(G,F){var{_copyTile:k,_bin:V,_paeth:j}=ir,J={table:function(){var r=new Uint32Array(256);for(var n=0;n<256;n++){var i=n;for(var s=0;s<8;s++)if(i&1)i=3988292384^i>>>1;else i=i>>>1;r[n]=i}return r}(),update:function(r,n,i,s){for(var v=0;v<s;v++)r=J.table[(r^n[i+v])&255]^r>>>8;return r},crc:function(r,n,i){return J.update(4294967295,r,n,i)^4294967295}};function z(r,n,i,s){n[i]+=r[0]*s>>4,n[i+1]+=r[1]*s>>4,n[i+2]+=r[2]*s>>4,n[i+3]+=r[3]*s>>4}function rr(r){return Math.max(0,Math.min(255,r))}function nr(r,n){var i=r[0]-n[0],s=r[1]-n[1],v=r[2]-n[2],h=r[3]-n[3];return i*i+s*s+v*v+h*h}function or(r,n,i,s,v,h,f){if(f==null)f=1;var c=s.length,t=[],a=[];for(var b=0;b<c;b++){var _=s[b];t.push([_>>>0&255,_>>>8&255,_>>>16&255,_>>>24&255])}for(var b=0;b<c;b++){var y=4294967295,I=0;for(var p=0;p<c;p++){var E=nr(t[b],t[p]);if(p!=b&&E<y)y=E,I=p}var D=Math.sqrt(y)/2;a[b]=~~(D*D)}var x=new Uint32Array(v.buffer),d=new Int16Array(n*i*4),m=4,q=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];for(var b=0;b<q.length;b++)q[b]=255*(-0.5+(q[b]+0.5)/(m*m));for(var X=0;X<i;X++)for(var Q=0;Q<n;Q++){var b=(X*n+Q)*4,tr;if(f!=2)tr=[rr(r[b]+d[b]),rr(r[b+1]+d[b+1]),rr(r[b+2]+d[b+2]),rr(r[b+3]+d[b+3])];else{var E=q[(X&m-1)*m+(Q&m-1)];tr=[rr(r[b]+E),rr(r[b+1]+E),rr(r[b+2]+E),rr(r[b+3]+E)]}var I=0,vr=16777215;for(var p=0;p<c;p++){var sr=nr(tr,t[p]);if(sr<vr)vr=sr,I=p}var lr=t[I],W=[tr[0]-lr[0],tr[1]-lr[1],tr[2]-lr[2],tr[3]-lr[3]];if(f==1){if(Q!=n-1)z(W,d,b+4,7);if(X!=i-1){if(Q!=0)z(W,d,b+4*n-4,3);if(z(W,d,b+4*n,5),Q!=n-1)z(W,d,b+4*n+4,1)}}h[b>>2]=I,x[b>>2]=s[I]}}function hr(r,n,i,s,v,h,f){if(s==null)s=0;if(f==null)f=!1;var c=o(r,n,i,s,[!1,!1,!1,0,f,!1]);return e(c,-1),ur(c,n,i,v,h)}function er(r,n,i,s,v,h,f,c){var t={ctype:0+(s==1?0:2)+(v==0?0:4),depth:h,frames:[]},a=Date.now(),b=(s+v)*h,_=b*n;for(var y=0;y<r.length;y++)t.frames.push({rect:{x:0,y:0,width:n,height:i},img:new Uint8Array(r[y]),blend:0,dispose:1,bpp:Math.ceil(b/8),bpl:Math.ceil(_/8)});e(t,0,!0);var I=ur(t,n,i,f,c);return I}function ur(r,n,i,s,v){if(v==null)v={};var h=J.crc,{writeUint:f,writeUshort:c,writeASCII:t}=V,a=8,b=r.frames.length>1,_=!1,y,I=33+(b?20:0);if(v.sRGB!=null)I+=13;if(v.pHYs!=null)I+=21;if(v.iCCP!=null)y=G.deflate(v.iCCP),I+=21+y.length+4;if(r.ctype==3){var p=r.plte.length;for(var E=0;E<p;E++)if(r.plte[E]>>>24!=255)_=!0;I+=8+p*3+4+(_?8+p*1+4:0)}for(var D=0;D<r.frames.length;D++){var x=r.frames[D];if(b)I+=38;if(I+=x.cimg.length+12,D!=0)I+=4}I+=12;var d=new Uint8Array(I),m=[137,80,78,71,13,10,26,10];for(var E=0;E<8;E++)d[E]=m[E];if(f(d,a,13),a+=4,t(d,a,"IHDR"),a+=4,f(d,a,n),a+=4,f(d,a,i),a+=4,d[a]=r.depth,a++,d[a]=r.ctype,a++,d[a]=0,a++,d[a]=0,a++,d[a]=0,a++,f(d,a,h(d,a-17,17)),a+=4,v.sRGB!=null)f(d,a,1),a+=4,t(d,a,"sRGB"),a+=4,d[a]=v.sRGB,a++,f(d,a,h(d,a-5,5)),a+=4;if(v.iCCP!=null){var q=13+y.length;f(d,a,q),a+=4,t(d,a,"iCCP"),a+=4,t(d,a,"ICC profile"),a+=11,a+=2,d.set(y,a),a+=y.length,f(d,a,h(d,a-(q+4),q+4)),a+=4}if(v.pHYs!=null)f(d,a,9),a+=4,t(d,a,"pHYs"),a+=4,f(d,a,v.pHYs[0]),a+=4,f(d,a,v.pHYs[1]),a+=4,d[a]=v.pHYs[2],a++,f(d,a,h(d,a-13,13)),a+=4;if(b)f(d,a,8),a+=4,t(d,a,"acTL"),a+=4,f(d,a,r.frames.length),a+=4,f(d,a,v.loop!=null?v.loop:0),a+=4,f(d,a,h(d,a-12,12)),a+=4;if(r.ctype==3){var p=r.plte.length;f(d,a,p*3),a+=4,t(d,a,"PLTE"),a+=4;for(var E=0;E<p;E++){var X=E*3,Q=r.plte[E],tr=Q&255,vr=Q>>>8&255,sr=Q>>>16&255;d[a+X+0]=tr,d[a+X+1]=vr,d[a+X+2]=sr}if(a+=p*3,f(d,a,h(d,a-p*3-4,p*3+4)),a+=4,_){f(d,a,p),a+=4,t(d,a,"tRNS"),a+=4;for(var E=0;E<p;E++)d[a+E]=r.plte[E]>>>24&255;a+=p,f(d,a,h(d,a-p-4,p+4)),a+=4}}var lr=0;for(var D=0;D<r.frames.length;D++){var x=r.frames[D];if(b)f(d,a,26),a+=4,t(d,a,"fcTL"),a+=4,f(d,a,lr++),a+=4,f(d,a,x.rect.width),a+=4,f(d,a,x.rect.height),a+=4,f(d,a,x.rect.x),a+=4,f(d,a,x.rect.y),a+=4,c(d,a,s[D]),a+=2,c(d,a,1000),a+=2,d[a]=x.dispose,a++,d[a]=x.blend,a++,f(d,a,h(d,a-30,30)),a+=4;var W=x.cimg,p=W.length;f(d,a,p+(D==0?0:4)),a+=4;var dr=a;if(t(d,a,D==0?"IDAT":"fdAT"),a+=4,D!=0)f(d,a,lr++),a+=4;d.set(W,a),a+=p,f(d,a,h(d,dr,a-dr)),a+=4}return f(d,a,0),a+=4,t(d,a,"IEND"),a+=4,f(d,a,h(d,a-4,4)),a+=4,d.buffer}function e(r,n,i){for(var s=0;s<r.frames.length;s++){var v=r.frames[s],h=v.rect.width,f=v.rect.height,c=new Uint8Array(f*v.bpl+f);v.cimg=S(v.img,f,v.bpp,v.bpl,c,n,i)}}function o(r,n,i,s,v){var h=v[0],f=v[1],c=v[2],t=v[3],a=v[4],b=v[5],_=6,y=8,I=255;for(var p=0;p<r.length;p++){var E=new Uint8Array(r[p]),D=E.length;for(var x=0;x<D;x+=4)I&=E[x+3]}var d=I!=255,m=w(r,n,i,h,f,c),q={},X=[],Q=[];if(s!=0){var tr=[];for(var x=0;x<m.length;x++)tr.push(m[x].img.buffer);var vr=K(tr),sr=N(vr,s);for(var x=0;x<sr.plte.length;x++)X.push(sr.plte[x].est.rgba);var lr=0;for(var x=0;x<m.length;x++){var W=m[x],dr=W.img.length,cr=new Uint8Array(sr.inds.buffer,lr>>2,dr>>2);Q.push(cr);var Ur=new Uint8Array(sr.abuf,lr,dr);if(b)or(W.img,W.rect.width,W.rect.height,X,Ur,cr);W.img.set(Ur),lr+=dr}}else for(var p=0;p<m.length;p++){var W=m[p],gr=new Uint32Array(W.img.buffer),fr=W.rect.width,D=gr.length,cr=new Uint8Array(D);Q.push(cr);for(var x=0;x<D;x++){var Ar=gr[x];if(x!=0&&Ar==gr[x-1])cr[x]=cr[x-1];else if(x>fr&&Ar==gr[x-fr])cr[x]=cr[x-fr];else{var yr=q[Ar];if(yr==null){if(q[Ar]=yr=X.length,X.push(Ar),X.length>=300)break}cr[x]=yr}}}var br=X.length;if(br<=256&&a==!1){if(br<=2)y=1;else if(br<=4)y=2;else if(br<=16)y=4;else y=8;y=Math.max(y,t)}for(var p=0;p<m.length;p++){var W=m[p],Er=W.rect.x,Nr=W.rect.y,fr=W.rect.width,Ir=W.rect.height,Rr=W.img,Or=new Uint32Array(Rr.buffer),pr=4*fr,Cr=4;if(br<=256&&a==!1){pr=Math.ceil(y*fr/8);var wr=new Uint8Array(pr*Ir),Mr=Q[p];for(var _r=0;_r<Ir;_r++){var x=_r*pr,xr=_r*fr;if(y==8)for(var ar=0;ar<fr;ar++)wr[x+ar]=Mr[xr+ar];else if(y==4)for(var ar=0;ar<fr;ar++)wr[x+(ar>>1)]|=Mr[xr+ar]<<4-(ar&1)*4;else if(y==2)for(var ar=0;ar<fr;ar++)wr[x+(ar>>2)]|=Mr[xr+ar]<<6-(ar&3)*2;else if(y==1)for(var ar=0;ar<fr;ar++)wr[x+(ar>>3)]|=Mr[xr+ar]<<7-(ar&7)*1}Rr=wr,_=3,Cr=1}else if(d==!1&&m.length==1){var wr=new Uint8Array(fr*Ir*3),Dr=fr*Ir;for(var x=0;x<Dr;x++){var Pr=x*3,Tr=x*4;wr[Pr]=Rr[Tr],wr[Pr+1]=Rr[Tr+1],wr[Pr+2]=Rr[Tr+2]}Rr=wr,_=2,Cr=3,pr=3*fr}W.img=Rr,W.bpl=pr,W.bpp=Cr}return{ctype:_,depth:y,plte:X,frames:m}}function w(r,n,i,s,v,h){var f=[];for(var c=0;c<r.length;c++){var t=new Uint8Array(r[c]),a=new Uint32Array(t.buffer),b,_=0,y=0,I=n,p=i,E=s?1:0;if(c!=0){var D=h||s||c==1||f[c-2].dispose!=0?1:2,x=0,d=1e9;for(var m=0;m<D;m++){var cr=new Uint8Array(r[c-1-m]),q=new Uint32Array(r[c-1-m]),X=n,Q=i,tr=-1,vr=-1;for(var sr=0;sr<i;sr++)for(var lr=0;lr<n;lr++){var W=sr*n+lr;if(a[W]!=q[W]){if(lr<X)X=lr;if(lr>tr)tr=lr;if(sr<Q)Q=sr;if(sr>vr)vr=sr}}if(tr==-1)X=Q=tr=vr=0;if(v){if((X&1)==1)X--;if((Q&1)==1)Q--}var dr=(tr-X+1)*(vr-Q+1);if(dr<d)d=dr,x=m,_=X,y=Q,I=tr-X+1,p=vr-Q+1}var cr=new Uint8Array(r[c-1-x]);if(x==1)f[c-1].dispose=2;if(b=new Uint8Array(I*p*4),k(cr,n,i,b,I,p,-_,-y,0),E=k(t,n,i,b,I,p,-_,-y,3)?1:0,E==1)C(t,n,i,b,{x:_,y,width:I,height:p});else k(t,n,i,b,I,p,-_,-y,0)}else b=t.slice(0);f.push({rect:{x:_,y,width:I,height:p},img:b,blend:E,dispose:0})}if(s)for(var c=0;c<f.length;c++){var Ur=f[c];if(Ur.blend==1)continue;var gr=Ur.rect,fr=f[c-1].rect,Ar=Math.min(gr.x,fr.x),yr=Math.min(gr.y,fr.y),br=Math.max(gr.x+gr.width,fr.x+fr.width),Er=Math.max(gr.y+gr.height,fr.y+fr.height),Nr={x:Ar,y:yr,width:br-Ar,height:Er-yr};if(f[c-1].dispose=1,c-1!=0)U(r,n,i,f,c-1,Nr,v);U(r,n,i,f,c,Nr,v)}var Ir=0;if(r.length!=1)for(var W=0;W<f.length;W++){var Ur=f[W];Ir+=Ur.rect.width*Ur.rect.height}return f}function U(r,n,i,s,v,h,f){var c=Uint8Array,t=Uint32Array,a=new c(r[v-1]),b=new t(r[v-1]),_=v+1<r.length?new c(r[v+1]):null,y=new c(r[v]),I=new t(y.buffer),p=n,E=i,D=-1,x=-1;for(var d=0;d<h.height;d++)for(var m=0;m<h.width;m++){var q=h.x+m,X=h.y+d,Q=X*n+q,tr=I[Q];if(tr==0||s[v-1].dispose==0&&b[Q]==tr&&(_==null||_[Q*4+3]!=0));else{if(q<p)p=q;if(q>D)D=q;if(X<E)E=X;if(X>x)x=X}}if(D==-1)p=E=D=x=0;if(f){if((p&1)==1)p--;if((E&1)==1)E--}h={x:p,y:E,width:D-p+1,height:x-E+1};var vr=s[v];if(vr.rect=h,vr.blend=1,vr.img=new Uint8Array(h.width*h.height*4),s[v-1].dispose==0)k(a,n,i,vr.img,h.width,h.height,-h.x,-h.y,0),C(y,n,i,vr.img,h);else k(y,n,i,vr.img,h.width,h.height,-h.x,-h.y,0)}function C(r,n,i,s,v){k(r,n,i,s,v.width,v.height,-v.x,-v.y,2)}function S(r,n,i,s,v,h,f){var c=[],t=[0,1,2,3,4];if(h!=-1)t=[h];else if(n*s>500000||i==1)t=[0];var a;if(f)a={level:0};var b=v.length>1e7&&F.UZIP!=null?F.UZIP:G,_=Date.now();for(var y=0;y<t.length;y++){for(var I=0;I<n;I++)A(v,r,I,s,i,t[y]);c.push(b.deflate(v,a))}var p,E=1e9;for(var y=0;y<c.length;y++)if(c[y].length<E)p=y,E=c[y].length;return c[p]}function A(r,n,i,s,v,h){var f=i*s,c=f+i;if(r[c]=h,c++,h==0)if(s<500)for(var t=0;t<s;t++)r[c+t]=n[f+t];else r.set(new Uint8Array(n.buffer,f,s),c);else if(h==1){for(var t=0;t<v;t++)r[c+t]=n[f+t];for(var t=v;t<s;t++)r[c+t]=n[f+t]-n[f+t-v]+256&255}else if(i==0){for(var t=0;t<v;t++)r[c+t]=n[f+t];if(h==2)for(var t=v;t<s;t++)r[c+t]=n[f+t];if(h==3)for(var t=v;t<s;t++)r[c+t]=n[f+t]-(n[f+t-v]>>1)+256&255;if(h==4)for(var t=v;t<s;t++)r[c+t]=n[f+t]-j(n[f+t-v],0,0)+256&255}else{if(h==2)for(var t=0;t<s;t++)r[c+t]=n[f+t]+256-n[f+t-s]&255;if(h==3){for(var t=0;t<v;t++)r[c+t]=n[f+t]+256-(n[f+t-s]>>1)&255;for(var t=v;t<s;t++)r[c+t]=n[f+t]+256-(n[f+t-s]+n[f+t-v]>>1)&255}if(h==4){for(var t=0;t<v;t++)r[c+t]=n[f+t]+256-j(0,n[f+t-s],0)&255;for(var t=v;t<s;t++)r[c+t]=n[f+t]+256-j(n[f+t-v],n[f+t-s],n[f+t-v-s])&255}}}function N(r,n,i){var s=Date.now(),v=new Uint8Array(r),h=v.slice(0),f=new Uint32Array(h.buffer),c=u(h,n),t=c[0],a=c[1],b=a.length,_=new Uint32Array(b),y=new Uint8Array(_.buffer);for(var I=0;I<b;I++)_[I]=a[I].est.rgba;var p=v.length,E=new Uint8Array(p>>2),D;if(b<=60)H(v,E,y),Z(E,f,_);else if(v.length<32000000)for(var I=0;I<p;I+=4){var x=v[I]*0.00392156862745098,d=v[I+1]*0.00392156862745098,m=v[I+2]*0.00392156862745098,q=v[I+3]*0.00392156862745098;D=g(t,x,d,m,q),E[I>>2]=D.ind,f[I>>2]=D.est.rgba}else for(var I=0;I<p;I+=4){var x=v[I]*0.00392156862745098,d=v[I+1]*0.00392156862745098,m=v[I+2]*0.00392156862745098,q=v[I+3]*0.00392156862745098;D=t;while(D.left)D=l(D.est,x,d,m,q)<=0?D.left:D.right;E[I>>2]=D.ind,f[I>>2]=D.est.rgba}if(i||v.length*b<40000000){var X=1e9;for(var I=0;I<10;I++){var Q=Y(v,E,y);if(Q/X>0.997)break;X=Q}for(var I=0;I<b;I++)a[I].est.rgba=_[I];Z(E,f,_)}return{abuf:h.buffer,inds:E,plte:a}}function Z(r,n,i){for(var s=0;s<r.length;s++)n[s]=i[r[s]]}function Y(r,n,i){M(r,n,i);var s=H(r,n,i);return s}function M(r,n,i){var s=i.length>>>2,v=new Uint32Array(s*4),h=new Uint32Array(s);for(var f=0;f<r.length;f+=4){var c=n[f>>>2],t=c*4;h[c]++,v[t]+=r[f],v[t+1]+=r[f+1],v[t+2]+=r[f+2],v[t+3]+=r[f+3]}for(var f=0;f<i.length;f++)i[f]=Math.round(v[f]/h[f>>>2])}function H(r,n,i){var s=0,v=i.length>>>2,h=[];for(var f=0;f<v;f++){var c=f*4,t=i[c],a=i[c+1],b=i[c+2],_=i[c+3],y=0,I=1e9;for(var p=0;p<v;p++){if(f==p)continue;var E=p*4,D=t-i[E],x=a-i[E+1],d=b-i[E+2],m=_-i[E+3],q=D*D+x*x+d*d+m*m;if(q<I)I=q,y=p}h[f]=Math.sqrt(I)*0.5,h[f]=h[f]*h[f]}for(var f=0;f<r.length;f+=4){var t=r[f],a=r[f+1],b=r[f+2],_=r[f+3],y=n[f>>>2],c=y*4,D=t-i[c],x=a-i[c+1],d=b-i[c+2],m=_-i[c+3],I=D*D+x*x+d*d+m*m;if(I>h[y])for(var p=0;p<v;p++){c=p*4,D=t-i[c],x=a-i[c+1],d=b-i[c+2],m=_-i[c+3];var q=D*D+x*x+d*d+m*m;if(q<I){if(I=q,y=p,I<h[p])break}}n[f>>>2]=y,s+=I}return s/(r.length>>>2)}function u(r,n,i){if(i==null)i=0.0001;var s=new Uint32Array(r.buffer),v={i0:0,i1:r.length,bst:null,est:null,tdst:0,left:null,right:null};v.bst=L(r,v.i0,v.i1),v.est=O(v.bst);var h=[v];while(h.length<n){var f=0,c=0;for(var t=0;t<h.length;t++)if(h[t].est.L>f)f=h[t].est.L,c=t;if(f<i)break;var a=h[c],b=P(r,s,a.i0,a.i1,a.est.e,a.est.eMq255),_=a.i0>=b||a.i1<=b;if(_){a.est.L=0;continue}var y={i0:a.i0,i1:b,bst:null,est:null,tdst:0,left:null,right:null};y.bst=L(r,y.i0,y.i1),y.est=O(y.bst);var I={i0:b,i1:a.i1,bst:null,est:null,tdst:0,left:null,right:null};I.bst={R:[],m:[],N:a.bst.N-y.bst.N};for(var t=0;t<16;t++)I.bst.R[t]=a.bst.R[t]-y.bst.R[t];for(var t=0;t<4;t++)I.bst.m[t]=a.bst.m[t]-y.bst.m[t];I.est=O(I.bst),a.left=y,a.right=I,h[c]=y,h.push(I)}h.sort(function(p,E){return E.bst.N-p.bst.N});for(var t=0;t<h.length;t++)h[t].ind=t;return[v,h]}function g(r,n,i,s,v){if(r.left==null)return r.tdst=R(r.est.q,n,i,s,v),r;var h=l(r.est,n,i,s,v),{left:f,right:c}=r;if(h>0)f=r.right,c=r.left;var t=g(f,n,i,s,v);if(t.tdst<=h*h)return t;var a=g(c,n,i,s,v);return a.tdst<t.tdst?a:t}function l(r,n,i,s,v){var h=r.e;return h[0]*n+h[1]*i+h[2]*s+h[3]*v-r.eMq}function R(r,n,i,s,v){var h=n-r[0],f=i-r[1],c=s-r[2],t=v-r[3];return h*h+f*f+c*c+t*t}function P(r,n,i,s,v,h){s-=4;var f=0;while(i<s){while(B(r,i,v)<=h)i+=4;while(B(r,s,v)>h)s-=4;if(i>=s)break;var c=n[i>>2];n[i>>2]=n[s>>2],n[s>>2]=c,i+=4,s-=4}while(B(r,i,v)>h)i-=4;return i+4}function B(r,n,i){return r[n]*i[0]+r[n+1]*i[1]+r[n+2]*i[2]+r[n+3]*i[3]}function L(r,n,i){var s=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],v=[0,0,0,0],h=i-n>>2;for(var f=n;f<i;f+=4){var c=r[f]*0.00392156862745098,t=r[f+1]*0.00392156862745098,a=r[f+2]*0.00392156862745098,b=r[f+3]*0.00392156862745098;v[0]+=c,v[1]+=t,v[2]+=a,v[3]+=b,s[0]+=c*c,s[1]+=c*t,s[2]+=c*a,s[3]+=c*b,s[5]+=t*t,s[6]+=t*a,s[7]+=t*b,s[10]+=a*a,s[11]+=a*b,s[15]+=b*b}return s[4]=s[1],s[8]=s[2],s[9]=s[6],s[12]=s[3],s[13]=s[7],s[14]=s[11],{R:s,m:v,N:h}}function O(r){var{R:n,m:i,N:s}=r,v=i[0],h=i[1],f=i[2],c=i[3],t=s==0?0:1/s,a=[n[0]-v*v*t,n[1]-v*h*t,n[2]-v*f*t,n[3]-v*c*t,n[4]-h*v*t,n[5]-h*h*t,n[6]-h*f*t,n[7]-h*c*t,n[8]-f*v*t,n[9]-f*h*t,n[10]-f*f*t,n[11]-f*c*t,n[12]-c*v*t,n[13]-c*h*t,n[14]-c*f*t,n[15]-c*c*t],b=a,_=T,y=[Math.random(),Math.random(),Math.random(),Math.random()],I=0,p=0;if(s!=0)for(var E=0;E<16;E++){if(y=_.multVec(b,y),p=Math.sqrt(_.dot(y,y)),y=_.sml(1/p,y),E!=0&&Math.abs(p-I)<0.000000001)break;I=p}var D=[v*t,h*t,f*t,c*t],x=_.dot(_.sml(255,D),y);return{Cov:a,q:D,e:y,L:I,eMq255:x,eMq:_.dot(y,D),rgba:(Math.round(255*D[3])<<24|Math.round(255*D[2])<<16|Math.round(255*D[1])<<8|Math.round(255*D[0])<<0)>>>0}}var T={multVec:function(r,n){return[r[0]*n[0]+r[1]*n[1]+r[2]*n[2]+r[3]*n[3],r[4]*n[0]+r[5]*n[1]+r[6]*n[2]+r[7]*n[3],r[8]*n[0]+r[9]*n[1]+r[10]*n[2]+r[11]*n[3],r[12]*n[0]+r[13]*n[1]+r[14]*n[2]+r[15]*n[3]]},dot:function(r,n){return r[0]*n[0]+r[1]*n[1]+r[2]*n[2]+r[3]*n[3]},sml:function(r,n){return[r*n[0],r*n[1],r*n[2],r*n[3]]}};function K(r){var n=0;for(var i=0;i<r.length;i++)n+=r[i].byteLength;var s=new Uint8Array(n),v=0;for(var i=0;i<r.length;i++){var h=new Uint8Array(r[i]),f=h.length;for(var c=0;c<f;c+=4){var t=h[c],a=h[c+1],b=h[c+2],_=h[c+3];if(_==0)t=a=b=0;s[v+c]=t,s[v+c+1]=a,s[v+c+2]=b,s[v+c+3]=_}v+=f}return s.buffer}ir.encode=hr,ir.encodeLL=er,ir.encode.compress=o,ir.encode.dither=or,ir.quantize=N,ir.quantize.findNearest=H,ir.quantize.getKDtree=u,ir.quantize.getNearest=g,ir.encode._compressPNG=e,ir.encode._main=ur})({deflate:(G,F)=>{if(typeof __js65_deflate>"u"||!__js65_deflate)throw Error("png.encode: this frontend registered no deflate, so PNG data cannot be compressed. Decoding still works.");return __js65_deflate(G,F&&F.level)}},{});function Br(G){if(!G.length)throw Error("png: palette is empty");for(let[F,k]of G.entries()){if(!Array.isArray(k)||k.length!==3)throw Error(\`png: palette[\${F}] is not an [r, g, b] triple\`);for(let V of k)if(!Number.isInteger(V)||V<0||V>255)throw Error(\`png: palette[\${F}] has a channel outside 0-255: \${k.join()}\`)}}function Sr(G,F,k,V){let j=new Map;for(let z=k.length-1;z>=0;z--){let[rr,nr,or]=k[z];j.set(rr<<16|nr<<8|or,z)}let J=new Uint8Array(G.length/4);for(let z=0;z<J.length;z++){let rr=G[z*4],nr=G[z*4+1],or=G[z*4+2],hr=j.get(rr<<16|nr<<8|or);if(hr!==void 0){J[z]=hr;continue}if(V){let er=z%F,ur=(z-er)/F;throw Error(\`png: color rgb(\${rr}, \${nr}, \${or}) at (\${er}, \${ur}) is not in the palette. Pass {exact: false} to take the nearest match instead.\`)}J[z]=Gr(rr,nr,or,k)}return J}function Gr(G,F,k,V){let j=0,J=1/0;for(let z=0;z<V.length;z++){let[rr,nr,or]=V[z],hr=(G-rr)**2+(F-nr)**2+(k-or)**2;if(hr<J)J=hr,j=z}return j}function Lr(G,F,k,V){let j=new Uint8Array(F*k),J=Math.ceil(F*V/8),z=8/V,rr=(1<<V)-1;for(let nr=0;nr<k;nr++){let or=nr*J,hr=nr*F;for(let er=0;er<F;er++){let ur=8-V-er%z*V;j[hr+er]=G[or+Math.floor(er/z)]>>ur&rr}}return j}function kr(G){let F=[];for(let k=0;k<G.length;k+=3)F.push([G[k],G[k+1],G[k+2]]);return F}function mr(G){let F=ir.decode(G);return{width:F.width,height:F.height,data:new Uint8Array(ir.toRGBA8(F)[0])}}function $r(G,F={}){let k=ir.decode(G),{width:V,height:j}=k;if(k.ctype===3){let rr=k.tabs.PLTE;if(!rr)throw Error("png: an indexed PNG with no PLTE chunk");return{width:V,height:j,pixels:Lr(k.data,V,j,k.depth),palette:kr(rr)}}if(!F.palette)throw Error(\`png: this is a color type \${k.ctype} image with no palette of its own, so .load needs one: png.load(bytes, {palette: [[r, g, b], ...]})\`);Br(F.palette);let J=F.palette.map((rr)=>[...rr]),z=new Uint8Array(ir.toRGBA8(k)[0]);return{width:V,height:j,palette:J,pixels:Sr(z,V,J,F.exact!==!1)}}function Hr(G){return G<=2?1:G<=4?2:G<=16?4:8}function Fr(G,F){let{width:k,height:V,pixels:j}=G;if(F.length>256)throw Error(\`png.encode: a palette of \${F.length} exceeds the 256 an indexed PNG can hold\`);for(let er=0;er<j.length;er++)if(j[er]>=F.length)throw Error(\`png.encode: pixel \${er} has index \${j[er]}, outside a palette of \${F.length}\`);let J=Hr(F.length),z=Math.ceil(J*k/8),rr=new Uint8Array(z*V),nr=8/J;for(let er=0;er<V;er++){let ur=er*z,e=er*k;for(let o=0;o<k;o++){let w=8-J-o%nr*J;rr[ur+Math.floor(o/nr)]|=j[e+o]<<w}}let or=F.map(([er,ur,e])=>(-16777216|e<<16|ur<<8|er)>>>0),hr={ctype:3,depth:J,plte:or,frames:[{rect:{x:0,y:0,width:k,height:V},img:rr,blend:0,dispose:1,bpp:1,bpl:z}]};return ir.encode._compressPNG(hr,0,!0),new Uint8Array(ir.encode._main(hr,k,V,0))}function Zr(G,F={}){let{width:k,height:V}=G,j=F.palette??("palette"in G?G.palette:void 0);if("pixels"in G){if(!j)throw Error("png.encode: an indexed image needs a palette");return Br(j),Fr(G,j)}let J=G.data,z=J.buffer.slice(J.byteOffset,J.byteOffset+J.byteLength);return new Uint8Array(ir.encode([z],k,V,F.colors??0))}return{load:$r,loadRgba:mr,encode:Zr,upng:ir};})();`;

// src/jsmodule/maps.generated.ts
var JS_MODULE_MAPS = new Map([]);

// src/jsmodule/sourcemap.ts
var B64 = new Map([..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"].map((c, i) => [c, i]));
function readVlq(text, at) {
  let result = 0;
  let shift = 0;
  for (;; ) {
    const digit = B64.get(text[at.i++]);
    if (digit === undefined)
      return NaN;
    result += (digit & 31) << shift;
    if (!(digit & 32))
      break;
    shift += 5;
  }
  const value = result >>> 1;
  return result & 1 ? -value : value;
}
function parseSourceMap(json) {
  if (!json)
    return;
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return;
  }
  if (!Array.isArray(raw.sources) || typeof raw.mappings !== "string")
    return;
  const lines = [];
  let sourceIndex = 0;
  let sourceLine = 0;
  let sourceColumn = 0;
  for (const group of raw.mappings.split(";")) {
    const mappings = [];
    let genColumn = 0;
    for (const segment of group.split(",")) {
      if (!segment)
        continue;
      const at = { i: 0 };
      genColumn += readVlq(segment, at);
      if (at.i >= segment.length)
        continue;
      sourceIndex += readVlq(segment, at);
      sourceLine += readVlq(segment, at);
      sourceColumn += readVlq(segment, at);
      if (!Number.isFinite(genColumn + sourceIndex + sourceLine + sourceColumn)) {
        return;
      }
      mappings.push({ genColumn, sourceIndex, sourceLine, sourceColumn });
    }
    mappings.sort((a, b) => a.genColumn - b.genColumn);
    lines.push(mappings);
  }
  const contents = Array.isArray(raw.sourcesContent) ? raw.sourcesContent : [];
  return {
    sources: raw.sources.map((s) => String(s)),
    sourcesContent: raw.sources.map((_, i) => {
      const c = contents[i];
      return typeof c === "string" ? c : undefined;
    }),
    lines
  };
}
function mapPosition(map, line, column) {
  const mappings = map?.lines[line - 1];
  if (!map || !mappings?.length)
    return;
  let found;
  for (const m of mappings) {
    if (m.genColumn > column)
      break;
    found = m;
  }
  const hit = found ?? mappings[0];
  const source = map.sources[hit.sourceIndex];
  if (source == null)
    return;
  return { source, line: hit.sourceLine + 1, column: hit.sourceColumn };
}

// src/jsmodule/index.ts
var JS_MODULES = new Map([
  ["bmp", text5],
  ["png", text6]
]);
function jsModuleNames() {
  return [...JS_MODULES.keys()].sort();
}
var parsedMaps = new Map;
function jsModuleMap(name) {
  if (!parsedMaps.has(name)) {
    parsedMaps.set(name, parseSourceMap(JS_MODULE_MAPS.get(name)));
  }
  return parsedMaps.get(name);
}

// src/jspreprocessor.ts
var RE_DIRECTIVE = /^\s*(\.[a-z_][a-z0-9_]*)\s*(.*?)\s*$/i;
var RE_INPUT_ARGS = /^([A-Za-z_$][\w$]*)\s*,\s*(.*)$/;
var RE_MODULE_NAME = /^[A-Za-z_$][\w$]*$/;
var OPENERS = new Set([
  ".if",
  ".ifdef",
  ".ifndef",
  ".ifblank",
  ".ifnblank",
  ".ifconst",
  ".ifnconst",
  ".ifref",
  ".ifnref",
  ".ifp02",
  ".ifsym",
  ".ifnsym",
  ".macro",
  ".mac",
  ".proc",
  ".scope",
  ".repeat",
  ".rep",
  ".struct",
  ".union",
  ".enum"
]);
var CLOSERS = new Set([
  ".endif",
  ".endmacro",
  ".endmac",
  ".endproc",
  ".endscope",
  ".endrep",
  ".endrepeat",
  ".endstruct",
  ".endunion",
  ".endenum"
]);
var DECLARATIONS = new Set([".jsinclude", ".jsinput", ".jsmodule"]);
function fail3(file, line, message) {
  const source = { file, line, column: 0 };
  throw new SourceError(`${message}`, source);
}
function unquote(file, line, arg) {
  const m = /^"([^"]*)"$|^'([^']*)'$/.exec(arg);
  if (!m)
    fail3(file, line, `Expected a quoted filename, got: ${arg}`);
  return m[1] ?? m[2];
}
function searchPaths(file, paths) {
  const out = [];
  const seen = new Set;
  for (const p of [dirOf(file), ...paths]) {
    const key = joinDir("", p);
    if (seen.has(key))
      continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}
function includeSearch(file, opts) {
  return searchPaths(file, opts.includePaths ?? ["./"]);
}
function inputSearch(file, opts) {
  const paths = opts.binIncludePaths?.length ? opts.binIncludePaths : opts.includePaths?.length ? opts.includePaths : [];
  return searchPaths(file, [...paths, "./"]);
}
function definesView(ctx) {
  return new Proxy({}, {
    get: (_target, prop) => typeof prop === "string" ? ctx.symbol(prop) : undefined,
    has: (_target, prop) => typeof prop === "string" && ctx.symbol(prop) !== undefined
  });
}
var BLOCK_ENDS = new Set([".jsend", ".jspostend"]);
function scan(lines, file) {
  const decls = { includes: [], inputs: [], modules: [] };
  const blocks = [];
  const posts = [];
  let depth = 0;
  let block;
  for (let i = 0;i < lines.length; i++) {
    const lineNo = i + 1;
    const m = RE_DIRECTIVE.exec(lines[i]);
    const directive = m ? m[1].toLowerCase() : undefined;
    const rest = m ? m[2] : "";
    if (block) {
      const end = block.post ? ".jspostend" : ".jsend";
      if (directive === end) {
        (block.post ? posts : blocks).push({ start: block.start, end: lineNo, body: block.body.join(`
`) });
        block = undefined;
      } else if (directive === ".jsbegin" || directive === ".jspostbegin") {
        fail3(file, lineNo, `${directive} inside a block that started on line ${block.start}`);
      } else if (directive && BLOCK_ENDS.has(directive)) {
        fail3(file, lineNo, `${directive} closing a block that needs ${end}`);
      } else {
        block.body.push(lines[i]);
      }
      continue;
    }
    if (!directive)
      continue;
    if (directive === ".jsend")
      fail3(file, lineNo, `.jsend without a matching .jsbegin`);
    if (directive === ".jspostend") {
      fail3(file, lineNo, `.jspostend without a matching .jspostbegin`);
    }
    if (directive === ".jspostbegin") {
      if (depth > 0) {
        fail3(file, lineNo, `.jspostbegin cannot appear inside .if/.macro/.proc/.repeat: ` + `it runs once at link time, so it can never be conditional`);
      }
      block = { start: lineNo, body: [], post: true };
      continue;
    }
    if (directive === ".jsbegin" || DECLARATIONS.has(directive)) {
      if (depth > 0 && DECLARATIONS.has(directive)) {
        fail3(file, lineNo, `${directive} cannot appear inside .if/.macro/.proc/.repeat: ` + `it is resolved before any block runs, so it can never be conditional`);
      }
      if (directive === ".jsbegin") {
        block = { start: lineNo, body: [], post: false };
      } else if (directive === ".jsinclude") {
        decls.includes.push({ path: unquote(file, lineNo, rest), line: lineNo });
      } else if (directive === ".jsmodule") {
        if (!RE_MODULE_NAME.test(rest)) {
          fail3(file, lineNo, `Expected .jsmodule <name>, got: ${rest || "(nothing)"}`);
        }
        decls.modules.push({ name: rest, line: lineNo });
      } else {
        const args = RE_INPUT_ARGS.exec(rest);
        if (!args)
          fail3(file, lineNo, `Expected .jsinput <name>, "<path>"`);
        if (args[1] === "baserom")
          fail3(file, lineNo, `.jsinput cannot be named baserom`);
        decls.inputs.push({ name: args[1], pattern: unquote(file, lineNo, args[2]), line: lineNo });
      }
      continue;
    }
    if (OPENERS.has(directive))
      depth++;
    else if (CLOSERS.has(directive) && depth > 0)
      depth--;
  }
  if (block) {
    fail3(file, block.start, block.post ? `.jspostbegin without a matching .jspostend` : `.jsbegin without a matching .jsend`);
  }
  return { decls, blocks, posts };
}
function loadModules(file, decls) {
  const out = [];
  const seen = new Set;
  for (const { name, line } of decls.modules) {
    const text = JS_MODULES.get(name);
    if (text == null) {
      fail3(file, line, `Unknown .jsmodule: ${name}
` + `  Known modules: ${jsModuleNames().join(", ")}`);
    }
    if (seen.has(name))
      continue;
    seen.add(name);
    out.push({ text, file: `<jsmodule ${name}>`, firstLine: 1, module: name });
  }
  return out;
}
function deflate2() {
  const codec = gzipCodec();
  return codec?.deflate ? (data, level) => codec.deflate(data, level) : undefined;
}
function loadInclude(file, path, opts) {
  const bases = includeSearch(file, opts);
  const found = opts.callbacks?.resolveText?.(bases, path);
  if (!found)
    fail3(file, 1, `Could not find .jsinclude file: ${path}`);
  return {
    text: found.content,
    file: joinDir(bases[found.baseIndex] ?? "", path),
    firstLine: 1
  };
}
function loadInput(bases, path, opts) {
  const found = opts.callbacks?.resolveBinary?.(bases, path);
  if (!found)
    return;
  const bytes = typeof found.content === "string" ? new TextEncoder().encode(found.content) : found.content;
  return {
    path: joinDir(bases[found.baseIndex] ?? "", path),
    bytes,
    text: new TextDecoder().decode(bytes)
  };
}
function resolveInputs(file, decls, opts) {
  const scope = {};
  const bases = inputSearch(file, opts);
  for (const { name, pattern, line } of decls.inputs) {
    if (!opts.callbacks)
      fail3(file, line, `.jsinput needs file callbacks: ${pattern}`);
    if (!isGlob(pattern)) {
      const loaded = loadInput(bases, pattern, opts);
      if (!loaded)
        fail3(file, line, `Could not find .jsinput file: ${pattern}`);
      scope[name] = loaded;
      continue;
    }
    let matches;
    try {
      matches = resolveGlob(opts.callbacks, bases, pattern);
    } catch (err) {
      fail3(file, line, `.jsinput ${err.message}`);
    }
    scope[name] = matches.map((m) => {
      const loaded = loadInput([m.base], m.path, opts);
      if (!loaded)
        fail3(file, line, `Could not read .jsinput file: ${joinDir(m.base, m.path)}`);
      return loaded;
    });
  }
  return scope;
}
var BASEROM_MAX_LENGTH = 32 * 1024 * 1024;
function growableRom(base) {
  const buffer = new ArrayBuffer(base.length, {
    maxByteLength: Math.max(BASEROM_MAX_LENGTH, base.length)
  });
  const rom = new Uint8Array(buffer);
  rom.set(base);
  return rom;
}
function diffRom(base, rom) {
  if (rom.buffer.detached) {
    throw new Error("baserom buffer was detached (transfer() is not allowed)");
  }
  const newLength = rom.length;
  if (newLength < base.length) {
    throw new Error(`baserom was shrunk from ${base.length} to ${newLength} bytes; the ROM can only grow`);
  }
  const runs = [];
  let i = 0;
  while (i < newLength) {
    if (rom[i] === (base[i] ?? 0)) {
      i++;
      continue;
    }
    const start = i;
    while (i < newLength && rom[i] !== (base[i] ?? 0))
      i++;
    runs.push({ offset: start, data: rom.slice(start, i) });
  }
  if (!runs.length && newLength === base.length)
    return;
  return { newLength, runs };
}
function lineCount(text) {
  return text.split(`
`).length;
}
function combine(prelude, body) {
  const spans = [];
  let start = 1;
  for (const segment of prelude) {
    spans.push({ start, segment });
    start += lineCount(segment.text);
  }
  const text = prelude.map((s) => s.text).join(`
`);
  spans.push({ start: lineCount(text) + 1, segment: body });
  return { code: `${text}
${body.text}`, spans };
}
function locate(spans, frame) {
  let span = spans[0];
  for (const s of spans) {
    if (s.start <= frame.line)
      span = s;
  }
  const segment = span.segment;
  const line = segment.firstLine + (frame.line - span.start);
  const column = Math.max(0, frame.column - 1);
  const here = { file: segment.file, line, column };
  if (segment.module == null)
    return { source: here, kind: "project" };
  const mapped = mapPosition(jsModuleMap(segment.module), line - 1, column);
  if (!mapped)
    return { source: here, kind: "unplaceable" };
  return {
    source: {
      file: `${segment.file}/${mapped.source}`,
      line: mapped.line,
      column: mapped.column
    },
    kind: "module"
  };
}
function blockError(err, file, start, spans) {
  const message = `JavaScript block failed: ${err instanceof Error ? err.message : String(err)}`;
  const frames = getJsFrames(err) ?? [];
  const located = frames.map((f) => locate(spans, f));
  const placed = located.filter((l) => l.kind !== "unplaceable");
  const head = placed.findIndex((l) => l.kind === "project");
  const rest = placed.filter((_, i) => i !== head);
  let source = head >= 0 ? { file, line: start, column: 0 } : undefined;
  for (let i = rest.length - 1;i >= 0; i--) {
    source = { ...rest[i].source, parent: source };
  }
  const out = new SourceError(message, head >= 0 ? { ...placed[head].source, parent: source } : { file, line: start, column: 0, parent: source });
  if (located.length) {
    out.stack = [
      `${out.name}: ${message}`,
      ...located.map(({ source: s }, i) => `    at ${frames[i].name ?? "<anonymous>"} (` + `${s.file}:${s.line}:${s.column + 1})`)
    ].join(`
`);
  } else if (err instanceof Error && err.stack) {
    out.stack = err.stack;
  }
  return out;
}
function blank(lines, start, end, text = "") {
  lines[start - 1] = text;
  for (let i = start;i < end; i++)
    lines[i] = "";
}
function jsPreprocess(code, file, opts) {
  const lines = code.split(`
`);
  const { decls, blocks, posts } = scan(lines, file);
  if (!blocks.length && !posts.length && !decls.includes.length && !decls.inputs.length && !decls.modules.length) {
    return { code, usedJavascript: false, blocks: 0 };
  }
  if (!opts.allowJavascript) {
    const first = [
      ...blocks.map((b) => ({ line: b.start, what: ".jsbegin" })),
      ...posts.map((b) => ({ line: b.start, what: ".jspostbegin" })),
      ...decls.includes.map((d) => ({ line: d.line, what: ".jsinclude" })),
      ...decls.inputs.map((d) => ({ line: d.line, what: ".jsinput" })),
      ...decls.modules.map((d) => ({ line: d.line, what: ".jsmodule" }))
    ].sort((x, y) => x.line - y.line)[0];
    fail3(file, first.line, `${first.what} requires --allow-javascript
` + `  JavaScript blocks execute arbitrary code at build time and are` + ` disabled by default.`);
  }
  const engine = jsEngine();
  if (!engine) {
    fail3(file, blocks.length ? blocks[0].start : 1, `This frontend has no JavaScript engine, so .jsbegin blocks cannot run`);
  }
  const prelude = [
    ...loadModules(file, decls),
    ...decls.includes.map((d) => loadInclude(file, d.path, opts))
  ];
  const inputs = resolveInputs(file, decls, opts);
  const out = [...lines];
  const jsDeflate = deflate2();
  const base = opts.baseRom ?? new Uint8Array(0);
  const baserom = growableRom(base);
  for (const b of blocks) {
    const { code: src, spans } = combine(prelude, { text: b.body, file, firstLine: b.start + 1 });
    const index = opts.jsActions.add((ctx) => {
      const a = new AsmModule(file, { file, line: b.start });
      try {
        engine.run(src, {
          a,
          defines: definesView(ctx),
          baserom,
          __js65_deflate: jsDeflate,
          ...inputs
        });
      } catch (err) {
        throw blockError(err, file, b.start, spans);
      }
      return a.actions;
    });
    blank(out, b.start, b.end, `.jsaction ${index}`);
  }
  for (const p of posts)
    blank(out, p.start, p.end);
  for (const { line } of decls.inputs)
    blank(out, line, line);
  for (const { line } of decls.modules)
    blank(out, line, line);
  for (let i = 0;i < lines.length; i++) {
    const m = RE_DIRECTIVE.exec(lines[i]);
    if (m && m[1].toLowerCase() === ".jsinclude")
      out[i] = "";
  }
  const romPatch = () => {
    try {
      return diffRom(base, baserom);
    } catch (err) {
      fail3(file, blocks[0]?.start ?? 1, err.message);
    }
  };
  const jsPost = posts.length ? {
    file,
    prelude: prelude.map(({ text, ...s }) => s.module != null ? s : { ...s, text }),
    blocks: posts.map((p) => ({ line: p.start, body: p.body }))
  } : undefined;
  return { code: out.join(`
`), usedJavascript: true, blocks: blocks.length, romPatch, jsPost };
}
function jsPostprocess(posts, image, labelMap) {
  const engine = jsEngine();
  if (!engine) {
    fail3(posts[0].file, posts[0].blocks[0].line, `This frontend has no JavaScript engine, so .jspostbegin blocks cannot run`);
  }
  const jsDeflate = deflate2();
  const rom = growableRom(image);
  for (const post of posts) {
    const prelude = post.prelude.map((s) => {
      if (s.module == null)
        return { ...s, text: s.text ?? "" };
      const text = JS_MODULES.get(s.module);
      if (text == null) {
        fail3(post.file, post.blocks[0].line, `Unknown .jsmodule: ${s.module}
  Known modules: ${jsModuleNames().join(", ")}`);
      }
      return { ...s, text };
    });
    for (const b of post.blocks) {
      const { code, spans } = combine(prelude, { text: b.body, file: post.file, firstLine: b.line + 1 });
      try {
        engine.run(code, { rom, labelMap, __js65_deflate: jsDeflate });
      } catch (err) {
        throw blockError(err, post.file, b.line, spans);
      }
      if (rom.buffer.detached) {
        fail3(post.file, b.line, "rom buffer was detached (transfer() is not allowed)");
      }
    }
  }
  return rom.slice();
}

// src/dbgfile.ts
var CA65_SEGMENTS = ["CODE", "RODATA", "BSS", "DATA", "ZEROPAGE", "NULL"];
var hex = (n, width = 0) => "0x" + (n < 0 ? n >>> 0 : n).toString(16).toUpperCase().padStart(width, "0");
var basename = (p) => p.substring(Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\")) + 1);
function mergeRanges(ranges, rank, join) {
  if (ranges.length < 2)
    return ranges;
  ranges.sort((a, b) => rank(a[0]) - rank(b[0]) || a[0] - b[0] || a[1] - b[1]);
  if (!join)
    return ranges;
  const out = [];
  for (const r of ranges) {
    const last = out[out.length - 1];
    if (last && last[0] === r[0] && last[1] + last[2] >= r[1]) {
      out[out.length - 1] = [last[0], last[1], Math.max(last[2], r[1] + r[2] - last[1]), -1];
    } else {
      out.push(r);
    }
  }
  return out;
}
function writeDbg(link) {
  const files = [];
  const fileIds = new Map;
  const types = [];
  const typeIds = new Map;
  const typeId = (val) => {
    let id = typeIds.get(val);
    if (id === undefined) {
      typeIds.set(val, id = types.length);
      types.push(val);
    }
    return id;
  };
  const fileId = (name, size, mtime, mod) => {
    const key = `${name}\x00${size}\x00${mtime}`;
    let id = fileIds.get(key);
    if (id === undefined) {
      fileIds.set(key, id = files.length);
      files.push({ name, size, mtime, mods: [] });
    }
    const mods = files[id].mods;
    if (mods[mods.length - 1] !== mod)
      mods.push(mod);
    return id;
  };
  const bases = [];
  let line = 0, scope = 0, sym = 0, csym = 0;
  for (const { module } of link.modules) {
    bases.push({ line, scope, sym, csym });
    line += module.debug?.lines.length ?? 0;
    scope += module.debug?.scopes.length ?? 0;
    sym += module.debug?.syms.length ?? 0;
    csym += module.debug?.hll.length ?? 0;
  }
  const exportIds = new Map;
  const exportId = (name) => {
    const m = link.exporter(name);
    const debug = m !== undefined ? link.modules[m].module.debug : undefined;
    if (m === undefined || !debug)
      return;
    let ids = exportIds.get(m);
    if (!ids) {
      exportIds.set(m, ids = new Map);
      debug.syms.forEach((s, i) => {
        if (s.export && (!ids.has(s.name) || s.scope === 0))
          ids.set(s.name, i);
      });
    }
    const i = ids.get(name);
    return i !== undefined ? bases[m].sym + i : undefined;
  };
  const out = {
    csym: [],
    line: [],
    mod: [],
    span: [],
    scope: [],
    sym: []
  };
  let spanBase = 0;
  link.modules.forEach(({ module, pieces }, m) => {
    const debug = module.debug;
    const base = bases[m];
    const name = module.name ?? `module_${m}`;
    const modFiles = debug ? debug.files.map((f) => fileId(f.name, f.size, f.mtime, m)) : [fileId(name, 0, 0, m)];
    out.mod.push(`mod	id=${m},name="${basename(name)}",file=${modFiles[0]}`);
    if (!debug)
      return;
    const rankOf = new Map;
    pieces.forEach((list, chunk) => {
      for (const p of list) {
        if (rankOf.has(p.seg))
          continue;
        const fixed = CA65_SEGMENTS.indexOf(link.segments[p.seg].name);
        rankOf.set(p.seg, fixed >= 0 ? fixed : CA65_SEGMENTS.length + chunk);
      }
    });
    const rank = (seg) => rankOf.get(seg) ?? Infinity;
    const spans = [];
    const spanIds = new Map;
    const spanList = (ranges, join = true) => {
      if (!ranges)
        return [];
      return mergeRanges(ranges, rank, join).map((r) => {
        let ids = spanIds.get(r[0]);
        if (!ids)
          spanIds.set(r[0], ids = new Map);
        const key = r[1] * 16777216 + r[2];
        let id = ids.get(key);
        if (id === undefined) {
          ids.set(key, id = spans.length);
          spans.push([r[0], r[1], r[2], r[3]]);
        } else if (spans[id][3] < 0) {
          spans[id][3] = r[3];
        }
        return spanBase + id;
      });
    };
    const place = (chunk, offset, size, type, to) => {
      for (const p of pieces[chunk] ?? []) {
        const s = Math.max(offset, p.start);
        const e = Math.min(offset + size, p.start + p.size);
        if (e <= s)
          continue;
        const whole = s === offset && e === offset + size;
        to([
          p.seg,
          p.segStart + s - p.start,
          e - s,
          whole && type >= 0 ? typeId(debug.types[type]) : -1
        ]);
      }
    };
    const own = [];
    const outer = [];
    if (!debug.lineOnly)
      module.chunks?.forEach((chunk, c) => {
        for (const [set, offset, size, type] of chunk.debugRuns ?? []) {
          const lines = debug.lineSets[set];
          place(c, offset, size, type, (r) => {
            (own[lines[0]] ??= []).push(r);
            for (let k = 1;k < lines.length; k++)
              (outer[lines[k]] ??= []).push(r);
          });
        }
      });
    debug.lines.forEach((l, i) => {
      let rec = `line	id=${base.line + i},file=${modFiles[l.file]},line=${l.line}`;
      if (l.type)
        rec += `,type=${l.type}`;
      if (l.count)
        rec += `,count=${l.count}`;
      const mine = spanList(own[i], false);
      const around = spanList(outer[i]);
      const ids = around.length ? [...new Set(mine.concat(around))] : mine;
      if (ids.length)
        rec += `,span=${ids.join("+")}`;
      out.line.push(rec);
    });
    debug.scopes.forEach((s, i) => {
      const ranges = [];
      for (const [chunk, offset, size] of s.runs) {
        place(chunk, offset, size, -1, (r) => ranges.push(r));
      }
      const ids = spanList(ranges);
      const size = ids.length && s.type !== "enum" ? spans[ids[0] - spanBase][2] : s.size;
      let rec = `scope	id=${base.scope + i},name="${s.name}",mod=${m}`;
      if (s.parent !== undefined)
        rec += `,type=${s.type ?? "scope"}`;
      if (size)
        rec += `,size=${size}`;
      if (s.parent !== undefined)
        rec += `,parent=${base.scope + s.parent}`;
      if (s.label !== undefined)
        rec += `,sym=${base.sym + s.label}`;
      if (ids.length)
        rec += `,span=${ids.join("+")}`;
      out.scope.push(rec);
    });
    debug.syms.forEach((s, i) => out.sym.push(symRecord(s, base.sym + i)));
    debug.hll.forEach((c, i) => {
      let rec = `csym	id=${base.csym + i},name="${c.name}",scope=${base.scope + c.scope},${""}type=${typeId(c.type)},sc=${c.sc}`;
      if (c.offs)
        rec += `,offs=${c.offs}`;
      if (c.sym !== undefined)
        rec += `,sym=${base.sym + c.sym}`;
      out.csym.push(rec);
    });
    for (let i = 0;i < spans.length; i++) {
      const [seg, start, size, type] = spans[i];
      out.span.push(`span	id=${spanBase + i},seg=${seg},start=${start},size=${size}${type >= 0 ? `,type=${type}` : ""}`);
    }
    spanBase += spans.length;
    function symRecord(s, id) {
      let rec = `sym	id=${id},name="${s.name}",addrsize=${s.addrsize}`;
      if (s.size)
        rec += `,size=${s.size}`;
      rec += s.parent !== undefined ? `,parent=${base.sym + s.parent}` : `,scope=${base.scope + (s.scope ?? 0)}`;
      if (s.defs?.length)
        rec += `,def=${s.defs.map((l) => base.line + l).join("+")}`;
      if (s.refs?.length)
        rec += `,ref=${s.refs.map((l) => base.line + l).join("+")}`;
      if (s.kind === "imp") {
        const exp = exportId(s.expr?.sym ?? s.name);
        return rec + (exp !== undefined ? `,type=imp,exp=${exp}` : ",type=imp");
      }
      const val = s.expr && link.resolve(m, s.expr);
      rec += `,val=${hex(val?.value ?? 0)}`;
      if (val?.seg !== undefined)
        rec += `,seg=${val.seg}`;
      return rec + `,type=${s.kind}`;
    }
  });
  const segs = link.segments.map((s, i) => {
    let rec = `seg	id=${i},name="${s.name}",start=${hex(s.start, 6)},size=${hex(s.size, 4)},addrsize=${s.addrsize},type=${s.readOnly ? "ro" : "rw"}`;
    if (s.oname !== undefined)
      rec += `,oname="${s.oname}",ooffs=${s.ooffs ?? 0}`;
    return rec;
  });
  const fileRecs = files.map((f, i) => `file	id=${i},name="${f.name}",size=${f.size},mtime=${hex(f.mtime, 8)},mod=${f.mods.join("+")}`);
  const typeRecs = types.map((t, i) => `type	id=${i},val="${t}"`);
  return [
    "version\tmajor=2,minor=0",
    `info	csym=${out.csym.length},file=${files.length},lib=0,line=${out.line.length},${""}mod=${out.mod.length},scope=${out.scope.length},seg=${segs.length},${""}span=${out.span.length},sym=${out.sym.length},type=${types.length}`,
    ...out.csym,
    ...fileRecs,
    ...out.line,
    ...out.mod,
    ...segs,
    ...out.span,
    ...out.scope,
    ...out.sym,
    ...typeRecs
  ].join(`
`) + `
`;
}

// src/linker.ts
function formatAddr(start, end) {
  if (end > start + 1) {
    return `${start.toString(16)}-${(end - 1).toString(16)}`;
  }
  return start.toString(16);
}
var RE_COLON = /:/g;
var RE_INLINE_COMMENT = /;(.*)$/;
var RE_LABEL_ONLY_LINE = /^\s*.*:\s*$/;
var RE_FULL_COMMENT_LINE = /^\s*;/;
var RE_LABEL_OR_COMMENT_LINE = /^\s*(;|.*:\s*$)/;

class Linker {
  opts;
  static assemble(contents) {
    const opts = { lineContinuations: true };
    const source = new Tokenizer(contents, "contents.s", opts);
    const asm = new Assembler(Cpu.P02);
    const toks = new TokenStream(undefined, undefined, opts);
    toks.enter(source);
    new Preprocessor(toks, asm).run();
    const linker = new Linker;
    linker.read(asm.module());
    const out = linker.link();
    const data = new Uint8Array(out.length);
    out.apply(data);
    return data;
  }
  static link(...files) {
    const linker = new Linker;
    for (const file of files) {
      linker.read(file);
    }
    return linker.link();
  }
  _link;
  _exports;
  labelMap;
  constructor(opts = {}) {
    this.opts = opts;
    this._link = new Link(opts.errorCollector, linkerDefines(opts.defines), opts.lto ?? true);
  }
  read(file) {
    this._link.readFile(file);
    return this;
  }
  base(data, offset = 0) {
    this._link.base(data, offset);
    return this;
  }
  romImage() {
    return this._link.romImage;
  }
  link(signal) {
    if (this.opts.linkerConfig != null) {
      this._link.checkAnonMode("A linker config");
      this._link.setConfig(parseLinkerConfig(this.opts.linkerConfig, this.opts.linkerConfigName));
    } else if (this.opts.target != null) {
      const target = Targets.get(this.opts.target.toLowerCase());
      if (!target) {
        this._link.fail(`Unknown target: ${this.opts.target}. Supported targets are ${[...Targets.keys()].join(", ")}`);
      }
      this._link.checkAnonMode(`--target ${this.opts.target}`);
      this._link.setTargetSegments(target.segments);
    }
    return this._link.link(signal);
  }
  report(verbose = false) {
    return this._link.report(verbose);
  }
  dbgFile(outputName) {
    return writeDbg(this._link.dbgLink(outputName));
  }
  outputFiles() {
    return this._link.outputFiles();
  }
  exports() {
    if (this._exports)
      return this._exports;
    return this._exports = this._link.buildExports();
  }
  watch(...offset) {
    this._link.watches.push(...offset);
  }
  static getComment(sourceLines, firstLine, line, debugLevel) {
    let comment = "";
    {
      const actualLine = line;
      if (debugLevel === 0) {
        const lines = sourceLines.slice(firstLine, actualLine + 1);
        const result = [];
        for (const l of lines) {
          const trimmed = l.trim();
          if (RE_FULL_COMMENT_LINE.test(l)) {
            const commentText = trimmed.substring(1).trim().replace(RE_COLON, "");
            if (commentText) {
              result.push(commentText);
            }
          } else if (RE_LABEL_ONLY_LINE.test(l)) {} else {
            const inlineCommentMatch = l.match(RE_INLINE_COMMENT);
            if (inlineCommentMatch) {
              const commentText = inlineCommentMatch[1].trim().replace(RE_COLON, "");
              if (commentText) {
                result.push(commentText);
              }
            }
          }
        }
        comment = result.join("\\n");
      } else {
        comment = sourceLines.slice(firstLine, actualLine + 1).filter((s) => !RE_LABEL_ONLY_LINE.test(s)).map((s) => s.trim().replace(RE_COLON, "")).join("\\n");
      }
    }
    return comment;
  }
  static getLabelTypeAndAddress(cpuAddr) {
    const labelType = cpuAddr < 8192 ? "NesInternalRam" : cpuAddr < 24576 ? "NesMemory" : cpuAddr < 32768 ? "NesSaveRam" : "NesPrgRom";
    let address = cpuAddr;
    if (address >= 24576 && labelType === "NesSaveRam") {
      address -= 24576;
    }
    return { type: labelType, address };
  }
  prgBaseOffset() {
    const data = this._link.data;
    const inesMagic = [78, 69, 83, 26];
    if (inesMagic.every((b, i) => data.get(i) === b)) {
      return (data.get(6) ?? 0) & 4 ? 528 : 16;
    }
    let offset = Infinity;
    for (const [_, seg] of this._link.segments) {
      if (seg.isRam || seg.out != null && seg.out !== "%O")
        continue;
      if (seg.memory >= 16384 && seg.offset < offset)
        offset = seg.offset;
    }
    return offset === Infinity ? 0 : offset;
  }
  getDebugInfo(sources, debugLevel = 1) {
    if (!sources)
      return "";
    const sourceLinesCache = new Map;
    const getSourceLines = (file) => {
      if (sourceLinesCache.has(file))
        return sourceLinesCache.get(file);
      const lines = sources.data.get(file)?.split(`
`);
      sourceLinesCache.set(file, lines);
      return lines;
    };
    const windowStartCache = new Map;
    const windowStarts = (file, lines) => {
      let starts = windowStartCache.get(file);
      if (!starts) {
        starts = new Int32Array(lines.length + 1);
        for (let i = 1;i <= lines.length; i++) {
          starts[i] = RE_LABEL_OR_COMMENT_LINE.test(lines[i - 1]) ? starts[i - 1] : i;
        }
        windowStartCache.set(file, starts);
      }
      return starts;
    };
    const commentCache = new Map;
    let cachedFile;
    let cachedComments;
    const commentFor = (source, line) => {
      if (source.file !== cachedFile) {
        cachedFile = source.file;
        cachedComments = commentCache.get(cachedFile);
        if (!cachedComments) {
          commentCache.set(cachedFile, cachedComments = new Map);
        }
      }
      let comment = cachedComments.get(line);
      if (comment === undefined) {
        const lines = getSourceLines(source.file);
        const start = !lines || line < 0 ? -1 : line <= lines.length ? windowStarts(source.file, lines)[line] : line;
        comment = start < 0 ? "" : Linker.getComment(lines, start, line, debugLevel);
        cachedComments.set(line, comment);
      }
      if (debugLevel >= 2) {
        const suffix = ` in file ${source.file}:${source.line}`;
        comment = comment ? comment + suffix : suffix.trim();
      }
      return comment;
    };
    let data = "";
    const labelMap = new Map;
    const seenLabels = new Set;
    const realLabels = new Set;
    for (const c of this._link.chunks || []) {
      if (c.labelIndex) {
        for (const [labelName, _] of c.labelIndex) {
          if (labelName.startsWith("@")) {
            const baseName = labelName.substring(1);
            const symbolsToCheck = this._link.debugSymbols || this._link.symbols || [];
            for (const s of symbolsToCheck) {
              if (s.expr?.sym && s.expr.sym.startsWith(baseName + "_")) {
                realLabels.add(s.expr.sym);
              }
            }
          } else {
            realLabels.add(labelName);
          }
        }
      }
    }
    const isAnonTempLabel = (name) => !realLabels.has(name);
    const addLabel = (entry, isAnonTemp = false) => {
      const key = `${entry.type}:${formatAddr(entry.start, entry.end)}`;
      const existing = labelMap.get(key);
      if (existing) {
        const existingIsAnonTemp = isAnonTempLabel(existing.label);
        if (entry.label && !isAnonTemp && existingIsAnonTemp) {
          existing.label = entry.label;
        }
        if (entry.comment && !existing.comment) {
          existing.comment = entry.comment;
        }
      } else {
        labelMap.set(key, entry);
      }
    };
    const prgBaseOffset = this.prgBaseOffset();
    const chunkLabels = new Set;
    for (const c of this._link.chunks || []) {
      if (c.labelIndex) {
        for (const [label, _offset] of c.labelIndex) {
          chunkLabels.add(label);
        }
      }
    }
    const symbolsToProcess = this._link.debugSymbols || this._link.symbols || [];
    for (const s of symbolsToProcess) {
      if (s.expr?.op !== "num")
        continue;
      if (!s.expr.sym)
        continue;
      if (chunkLabels.has(s.expr.sym))
        continue;
      let labelType;
      let addr;
      const meta = s.expr.meta;
      const chunk = meta?.chunk != null && typeof meta.chunk === "number" && this._link.chunks ? this._link.chunks[meta.chunk] : undefined;
      const value = chunk && meta?.rel ? (chunk.org ?? 0) + (s.expr.num ?? 0) : s.expr.num ?? 0;
      if (chunk?.segment?.isRam || !chunk) {
        const result = Linker.getLabelTypeAndAddress(value);
        labelType = result.type;
        addr = result.address;
      } else {
        const offsetInChunk = value - (chunk.org ?? 0);
        const fileOffset = chunk.fileOffsetAt(offsetInChunk) ?? offsetInChunk;
        addr = fileOffset - prgBaseOffset;
        labelType = "NesPrgRom";
      }
      let comment = "";
      if (s.expr.source) {
        comment = commentFor(s.expr.source, s.expr.source.line);
      }
      const isAnonTemp = isAnonTempLabel(s.expr.sym);
      addLabel({
        type: labelType,
        start: addr,
        end: addr + 1,
        label: s.expr.sym,
        comment
      }, isAnonTemp);
      seenLabels.add(s.expr.sym);
    }
    for (const c of this._link.chunks || []) {
      if (!c.overlaps)
        continue;
      const isRamChunk = c.segment?.isRam ?? false;
      if (!c.labelIndex)
        continue;
      for (const [labelName, offsetInChunk] of c.labelIndex) {
        if (seenLabels.has(labelName))
          continue;
        let labelType;
        let addr;
        if (isRamChunk) {
          const cpuAddr = (c.org ?? 0) + offsetInChunk;
          const result = Linker.getLabelTypeAndAddress(cpuAddr);
          labelType = result.type;
          addr = result.address;
        } else {
          if (c.offset == null) {
            continue;
          }
          const fileOffset = c.fileOffsetAt(offsetInChunk);
          addr = fileOffset - prgBaseOffset;
          labelType = "NesPrgRom";
        }
        let comment = "";
        const srcInfo = c.sourceAt(offsetInChunk);
        if (srcInfo)
          comment = commentFor(srcInfo, srcInfo.line - 1);
        addLabel({
          type: labelType,
          start: addr,
          end: addr + 1,
          label: labelName,
          comment
        }, false);
        seenLabels.add(labelName);
      }
    }
    for (const c of this._link.chunks || []) {
      if (c.overlaps)
        continue;
      const isRamChunk = c.segment?.isRam ?? false;
      const rev = new Map;
      for (const [k, v] of c.labelIndex || []) {
        rev.set(v, k);
      }
      const pieceStarts = new Set(c.pieces.map((p) => p.start).filter((s) => s > 0));
      let rangeStart = -1;
      let rangeEnd = -1;
      let rangeSrcInfo;
      let rangeName;
      let name = c.name;
      const flushRange = () => {
        if (rangeStart < 0 || !rangeSrcInfo)
          return;
        const comment = commentFor(rangeSrcInfo, rangeSrcInfo.line - 1);
        const n = !seenLabels.has(rangeName) ? rangeName : "";
        if (debugLevel === 0 && !comment && !n) {
          rangeStart = -1;
          return;
        }
        seenLabels.add(n);
        if (isRamChunk) {
          const memAddrStart = c.org + rangeStart;
          const memAddrEnd = c.org + rangeEnd;
          const labelType = memAddrStart < 8192 ? "NesInternalRam" : memAddrStart < 24576 ? "NesMemory" : memAddrStart < 32768 ? "NesSaveRam" : "NesWorkRam";
          let addrStart = memAddrStart;
          let addrEnd = memAddrEnd;
          if (memAddrStart >= 24576 && memAddrStart < 32768) {
            addrStart -= 24576;
            addrEnd -= 24576;
          }
          addLabel({
            type: labelType,
            start: addrStart,
            end: addrEnd,
            label: n,
            comment
          }, false);
        } else {
          const prgRomOffsetStart = c.fileOffsetAt(rangeStart) - prgBaseOffset;
          const prgRomOffsetEnd = c.fileOffsetAt(rangeEnd - 1) + 1 - prgBaseOffset;
          addLabel({
            type: "NesPrgRom",
            start: prgRomOffsetStart,
            end: prgRomOffsetEnd,
            label: n,
            comment
          }, false);
        }
        rangeStart = -1;
      };
      const ranges = c.sourceRanges();
      let r = 0;
      for (let offset = 0;offset < c.size; offset++) {
        name = rev.get(offset) || name;
        while (r < ranges.length && ranges[r][1] <= offset)
          r++;
        const srcInfo = r < ranges.length && ranges[r][0] <= offset ? ranges[r][2] : undefined;
        const sameSource = srcInfo && rangeSrcInfo && srcInfo.file === rangeSrcInfo.file && srcInfo.line === rangeSrcInfo.line;
        if (srcInfo && sameSource && offset === rangeEnd && !pieceStarts.has(offset)) {
          rangeEnd = offset + 1;
        } else {
          flushRange();
          if (srcInfo) {
            rangeStart = offset;
            rangeEnd = offset + 1;
            rangeSrcInfo = srcInfo;
            rangeName = name;
          }
        }
      }
      flushRange();
    }
    this.labelMap = new Map;
    for (const label of labelMap.values()) {
      if (label.label && !this.labelMap.has(label.label)) {
        this.labelMap.set(label.label, label);
      }
    }
    for (const label of labelMap.values()) {
      data += `${label.type}:${formatAddr(label.start, label.end)}:${label.label}:${label.comment}
`;
    }
    return data;
  }
}
function fail4(msg) {
  fail(msg);
}
function impossible(msg) {
  throw new Error(msg);
}
function anonSegmentLabel(name, memory) {
  const src = Segment.anonSource(name);
  if (!src)
    return name;
  const at = src.line != null ? `${src.file}:${src.line}` : src.file;
  return `@${at} $${memory.toString(16)}`;
}
function segmentLabel(s) {
  return Segment.isAnon(s.name) ? `anonymous segment ${anonSegmentLabel(s.name, s.memory)}` : `segment ${s.name}`;
}
function alignUp(value, align) {
  return align > 1 ? Math.ceil(value / align) * align : value;
}

class FreeSpace extends IntervalSet {
  bySize = new Map;
  sizes = [];
  replace(s, e, entries) {
    for (let i = s;i < e; i++) {
      const [start, end] = this.data[i];
      this.unindex(start, end - start);
    }
    super.replace(s, e, entries);
    for (const [start, end] of entries)
      this.index(start, end - start);
  }
  index(start, len) {
    let starts = this.bySize.get(len);
    if (!starts) {
      this.bySize.set(len, starts = []);
      this.sizes.splice(lowerBound(this.sizes, len), 0, len);
    }
    starts.splice(lowerBound(starts, start), 0, start);
  }
  unindex(start, len) {
    const starts = this.bySize.get(len);
    if (!starts)
      return;
    const i = lowerBound(starts, start);
    if (starts[i] !== start)
      return;
    starts.splice(i, 1);
    if (!starts.length) {
      this.bySize.delete(len);
      this.sizes.splice(lowerBound(this.sizes, len), 1);
    }
  }
  rangeAt(x) {
    const i = this._find(x);
    return i >= 0 ? this.data[i] : undefined;
  }
  firstFit(s0, s1, size, align, delta) {
    for (const [f0, f1] of this.tail(s0)) {
      if (f0 >= s1)
        return;
      const intervalEnd = Math.min(f1, s1);
      const start = alignUp(f0 - delta, align) + delta;
      if (start + size > intervalEnd)
        continue;
      return start;
    }
    return;
  }
  bestFit(s0, s1, size, align, delta, slack) {
    let found;
    let smallest = Infinity;
    const consider = (f0, end) => {
      const start = alignUp(f0 - delta, align) + delta;
      if (start + size > end)
        return false;
      const df = end - f0;
      if (df >= smallest)
        return false;
      found = start;
      smallest = df;
      return true;
    };
    const lo = this._find(s0);
    if (lo >= 0 && this.data[lo][0] < s0) {
      consider(s0, Math.min(this.data[lo][1], s1));
    }
    const widest = s1 - s0;
    for (let k = lowerBound(this.sizes, size);k < this.sizes.length; k++) {
      const len = this.sizes[k];
      if (len > widest || len >= smallest)
        break;
      const starts = this.bySize.get(len);
      let done = false;
      for (let i = lowerBound(starts, s0);i < starts.length; i++) {
        const f0 = starts[i];
        if (f0 + len > s1)
          break;
        if (consider(f0, f0 + len)) {
          done = true;
          break;
        }
      }
      if (done)
        break;
    }
    const hi = this._find(s1);
    if (hi >= 0 && this.data[hi][0] >= s0)
      consider(this.data[hi][0], s1);
    if (slack)
      slack.value = smallest;
    return found;
  }
}

class LinkSegment {
  name;
  bank;
  size;
  offset;
  memory;
  addressing;
  fill;
  out;
  dedupe;
  isRam;
  windows;
  static isRamSegment(segment) {
    return segment.bss ?? (!segment.out && segment.offset == null);
  }
  constructor(segment, windows, ramBase = LinkSegment.RAM_OFFSET) {
    const name = this.name = segment.name;
    this.bank = segment.bank ?? 0;
    this.addressing = segment.addressing ?? 2;
    this.size = segment.size ?? fail4(`Size must be specified: ${name}`);
    this.isRam = LinkSegment.isRamSegment(segment);
    this.ramBase = ramBase;
    this.offset = segment.offset ?? (this.isRam ? segment.memory ?? 0 : fail4(`Offset must be specified: ${name}`));
    this.memory = segment.memory ?? 0;
    this.fill = segment.fill;
    this.out = segment.out;
    this.dedupe = segment.dedupe ?? false;
    this.windows = windows ?? [[0, this.size]];
  }
  static RAM_OFFSET = 2147483648;
  ramBase;
  get delta() {
    return this.isRam ? this.ramBase : this.offset - this.memory;
  }
}
var sourceLines = new WeakMap;

class LinkChunk {
  linker;
  index;
  chunkOffset;
  symbolOffset;
  name;
  size;
  align;
  segments;
  asserts;
  placement;
  isMirrored = false;
  subs = new Set;
  selfSubs = new Set;
  imports = new Set;
  follow = new Map;
  overlaps = false;
  labelIndex;
  source;
  debugRuns;
  debug;
  _sourceRanges;
  _data;
  _org;
  _pieces = [];
  _overwrite;
  constructor(linker, index, chunk, chunkOffset, symbolOffset, debug) {
    this.linker = linker;
    this.index = index;
    this.chunkOffset = chunkOffset;
    this.symbolOffset = symbolOffset;
    this.name = chunk.name;
    this.size = chunk.data.length;
    this.align = chunk.align;
    this.segments = chunk.segments;
    this.placement = chunk.placement ?? "declarationOrder";
    this.labelIndex = chunk.labelIndex && new Map(chunk.labelIndex);
    this.source = chunk.source;
    this.debugRuns = chunk.debugRuns;
    this.debug = debug;
    this._data = chunk.data;
    for (const sub of chunk.subs || []) {
      this.subs.add(translateSub(sub, chunkOffset, symbolOffset));
    }
    this.asserts = (chunk.asserts || []).map((a) => ({ ...a, expr: translateExpr(a.expr, chunkOffset, symbolOffset) }));
    if (chunk.org != null)
      this._org = chunk.org;
    this._overwrite = chunk.overwrite || "allow";
  }
  get org() {
    return this._org;
  }
  get offset() {
    return this._pieces[0]?.offset;
  }
  get segment() {
    return this._pieces[0]?.segment;
  }
  get data() {
    return this._data ?? impossible("no data");
  }
  get pieces() {
    return this._pieces;
  }
  fileOffsetAt(k) {
    const p = this._pieces.find((p) => k >= p.start && k < p.start + p.size) ?? (k === this.size ? this._pieces.find((p) => p.start + p.size === k) : undefined) ?? this._pieces[0];
    return p && p.offset + k - p.start;
  }
  at() {
    const source = this.source;
    return source && { source };
  }
  sourceRanges() {
    if (this._sourceRanges)
      return this._sourceRanges;
    const out = [];
    const debug = this.debug;
    if (debug) {
      let lines = sourceLines.get(debug);
      if (!lines)
        sourceLines.set(debug, lines = []);
      for (const [set, offset, size, type] of this.debugRuns ?? []) {
        const id = debug.lineSets[set][0];
        let line = lines[id];
        if (!line) {
          const l = debug.lines[id];
          lines[id] = line = { file: debug.files[l.file].name, line: l.line };
        }
        out.push([offset, offset + (type === DEBUG_RUN_CODE ? 1 : size), line]);
      }
    }
    return this._sourceRanges = out;
  }
  sourceAt(k) {
    return this.sourceRanges().find(([s, e]) => k >= s && k < e)?.[2];
  }
  mirrorSegments() {
    return this.segments.map((name) => {
      const s = this.linker.segments.get(name);
      if (!s)
        this.linker.fail(`Unknown segment: ${name}`, this.at());
      return s;
    });
  }
  resolveMirrorOrg() {
    if (this.placement !== "all")
      return;
    this.isMirrored = true;
    if (this._org != null)
      return;
    const linkSegs = this.mirrorSegments();
    const size = this.size;
    const align = this.align ?? 1;
    let org = Math.max(...linkSegs.map((s) => s.memory + (s.windows[0]?.[0] ?? s.size)));
    let settled;
    do {
      settled = org;
      for (const s of linkSegs) {
        const base = s.isRam ? s.memory + s.delta : s.offset;
        let start;
        for (const [lo, hi] of s.windows) {
          const s0 = Math.max(base + lo, org + s.delta);
          const s1 = base + hi;
          if (s0 >= s1)
            continue;
          start = this.linker.free.firstFit(s0, s1, size, align, s.delta);
          if (start != null)
            break;
        }
        start ??= this.linker.fail(`Cannot place chunk ${this.name} mirrored across ${this.segments.join(" & ")}. Couldn't find a common free space ${""}in all provided banks.`, this.at());
        org = Math.max(org, start - s.delta);
      }
    } while (settled !== org);
    this._org = org;
    this.mirrorPlacement();
  }
  fixedPlacements() {
    if (this._org == null || !this._data)
      return;
    if (this.placement === "all")
      return this.mirrorPlacement();
    const eligibleSegments = [];
    for (const name of this.segments) {
      const s = this.linker.segments.get(name);
      if (!s)
        this.linker.fail(`Unknown segment: ${name}`, this.at());
      if (this._org >= s.memory && this._org < s.memory + s.size) {
        eligibleSegments.push(s);
      }
    }
    if (eligibleSegments.length !== 1) {
      if (!eligibleSegments.length && this.segments.length === 1 && Segment.isAnon(this.segments[0])) {
        const s = this.linker.segments.get(this.segments[0]);
        this.linker.fail(`.org $${this._org.toString(16)} is outside the ${""}anonymous segment ${anonSegmentLabel(s.name, s.memory)} ${""}(size $${s.size.toString(16)})`, this.at());
      }
      this.linker.fail(`Non-unique segment for ${this.name}:
${""}Segments: ${this.segments.join(",")}, ${""}org: $${this.org?.toString(16)}, ${""}offset: $${this.offset?.toString(16)}
${""}Eligible: [${eligibleSegments}]`, this.at());
    }
    const segment = eligibleSegments[0];
    const end = segment.memory + segment.size;
    if (this._org + this.size > end) {
      const tail = this._org + this.size - end;
      const next = this.segments.map((n) => this.linker.segments.get(n)).find((s) => s.memory === end && s.windows[0]?.[0] === 0 && s.windows[0][1] >= tail);
      if (next)
        return this.placeSplit(this._org, segment, next, this._overwrite);
      this.linker.fail(`Chunk ($${this.size.toString(16)} bytes at $${this._org.toString(16)}) does not fit in ${""}${segmentLabel(segment)} (size $${segment.size.toString(16)})`, this.at());
    }
    this.place(this._org, segment, this._overwrite);
  }
  mirrorPlacement() {
    const segments = this.mirrorSegments();
    const org = this._org;
    const bad = segments.filter((s) => org < s.memory || org + this.size > s.memory + s.size);
    if (bad.length) {
      this.linker.fail(`Chunk ($${this.size.toString(16)} bytes at $${org.toString(16)}) mirrored across ${this.segments.join(" & ")} does not fit in ${bad.map((s) => segmentLabel(s)).join(", ")}`, this.at());
    }
    this.place(org, segments[0], this._overwrite, segments.slice(1));
  }
  place(org, segment, overwrite, mirrors = []) {
    this.placePieces(org, [segment, ...mirrors].map((s) => ({ segment: s, offset: org + s.delta, start: 0, size: this.size })), overwrite);
  }
  placeSplit(org, head, tail, overwrite) {
    const n = head.memory + head.size - org;
    this.placePieces(org, [
      { segment: head, offset: org + head.delta, start: 0, size: n },
      {
        segment: tail,
        offset: tail.memory + tail.delta,
        start: n,
        size: this.size - n
      }
    ], overwrite);
  }
  placePieces(org, pieces, overwrite) {
    this._org = org;
    this._pieces = pieces;
    const data = this._data ?? impossible(`No data`);
    this._data = undefined;
    for (const piece of this._pieces) {
      this.writePiece(org, piece, data, overwrite);
    }
    for (const [sub, chunk] of this.follow) {
      chunk.resolveSub(sub, false);
    }
  }
  writePiece(org, piece, chunkData, overwrite) {
    const { segment, offset, start, size } = piece;
    for (const w of this.linker.watches) {
      if (w >= offset && w < offset + size)
        fail4("Unable to place");
    }
    binaryInsert(this.linker.placed, (x) => x[0], [offset, this, piece]);
    if (segment.isRam) {
      this.linker.free.delete(offset, offset + size);
      return;
    }
    const full = this.linker.data;
    const data = chunkData.subarray(start, start + size);
    if (this.subs.size) {
      full.splice(offset, data.length);
      const sparse = new SparseByteArray;
      sparse.set(0, data);
      for (const sub of this.subs) {
        const s = Math.max(sub.offset - start, 0);
        const e = Math.min(sub.offset - start + sub.size, size);
        if (e > s)
          sparse.splice(s, e - s);
      }
      for (const [at, chunk] of sparse.chunks()) {
        full.set(offset + at, chunk);
      }
    } else {
      full.set(offset, data);
    }
    if (overwrite && data.length) {
      let overwritten = false;
      const [next] = this.linker.written.tail(offset);
      if (next?.[0] <= offset && next[1] >= offset + data.length) {
        overwritten = true;
      } else if (next?.[0] < offset + data.length) {
        overwritten = null;
      }
      let error = "";
      if (overwrite === "require" && overwritten !== true) {
        error = `required to overwrite ${data.length} bytes but did not.`;
      } else if (overwrite === "forbid" && overwritten !== false) {
        error = `forbidden to overwrite ${data.length} but did anyway.`;
      }
      if (error) {
        error = `Chunk at ${segment.name}:$${(org + start).toString(16).padStart(4, "0")} (offset $${offset.toString(16).padStart(5, "0")} was ${error}`;
        if (!NO_THROW)
          throw new Error(error);
        if (!QUIET)
          console.error(error);
      }
      this.linker.written.add(offset, offset + data.length);
    }
    this.linker.free.delete(offset, offset + size);
  }
  resolveSubs(initial = false) {
    for (const sub of this.selfSubs) {
      this.resolveSub(sub, initial);
    }
    for (const sub of this.subs) {
      this.resolveSub(sub, initial);
    }
  }
  addDep(sub, dep) {
    if (dep === this.index && this.subs.delete(sub))
      this.selfSubs.add(sub);
    this.linker.chunks[dep].follow.set(sub, this);
  }
  resolveSub(sub, initial) {
    if (!this.subs.has(sub) && !this.selfSubs.has(sub))
      return;
    sub.expr = traverse(sub.expr, (e, rec, p) => {
      const bankOp = p?.op === "^" || p?.op === ".bankbyte";
      if (initial && bankOp && p.args.length === 1 && e.meta) {
        const target = e.meta.chunk != null ? this.linker.chunks[e.meta.chunk] : undefined;
        if (target?.isMirrored) {
          this.linker.errorCollector?.add("warning", `.bank value is 0 for mirrored data`, p.source ?? e.source ?? sub.expr.source);
          e.meta.bank = 0;
        }
        if (e.meta.bank == null) {
          this.addDep(sub, e.meta.chunk);
        }
        return e;
      }
      e = this.linker.resolveLink(evaluate(rec(e)));
      if (initial && e.meta?.rel)
        this.addDep(sub, e.meta.chunk);
      return e;
    });
    let del = false;
    if (sub.expr.op === "num" && !sub.expr.meta?.rel) {
      this.subs.delete(sub) || this.selfSubs.delete(sub);
      this.writeValue(sub.offset, sub.expr.num, sub.size, sub.expr.meta?.branch, sub.expr.source, sub.forceRange);
    } else if (sub.expr.op === ".move") {
      if (sub.expr.args.length !== 1)
        throw new Error(`bad .move`);
      const child = sub.expr.args[0];
      if (child.op === "num" && child.meta?.offset != null) {
        const meta = child.meta;
        const k = child.num - (meta.rel ? 0 : meta.org);
        const target = meta.chunk != null ? this.linker.chunks[meta.chunk] : undefined;
        const start = target?.fileOffsetAt(k) ?? meta.offset + k;
        this.writeBytes(sub.offset, this.linker.orig.slice(start, start + sub.size));
        del = true;
      }
    }
    if (del) {
      this.subs.delete(sub) || this.selfSubs.delete(sub);
    }
  }
  writeBytes(offset, bytes) {
    if (this._data) {
      this._data.subarray(offset, offset + bytes.length).set(bytes);
    } else if (this._pieces.length) {
      for (const p of this._pieces) {
        const s = Math.max(offset, p.start);
        const e = Math.min(offset + bytes.length, p.start + p.size);
        if (e <= s)
          continue;
        this.linker.data.set(p.offset + s - p.start, bytes.subarray(s - offset, e - offset));
      }
    } else {
      throw new Error(`Impossible`);
    }
  }
  writeValue(offset, val, size, isBranch, source, forceRange) {
    if (!forceRange && val != null && !fits(val, size, isBranch)) {
      const at = this.org != null ? ` at $${(this.org + offset).toString(16)}` : "";
      this.linker.fail(rangeErrorMessage(val, size, isBranch, at), source && { source });
    }
    const bytes = new Uint8Array(size);
    for (let i = 0;i < size; i++) {
      bytes[i] = val & 255;
      val >>= 8;
    }
    this.writeBytes(offset, bytes);
  }
}
function translateSub(s, dc, ds) {
  s = { ...s };
  s.expr = translateExpr(s.expr, dc, ds);
  return s;
}
function translateExpr(e, dc, ds) {
  e = { ...e };
  if (e.meta)
    e.meta = { ...e.meta };
  if (e.args)
    e.args = e.args.map((a) => translateExpr(a, dc, ds));
  if (e.meta?.chunk != null)
    e.meta.chunk += dc;
  if (e.op === "sym" && e.num != null)
    e.num += ds;
  return e;
}
function translateSymbol(s, dc, ds) {
  s = { ...s };
  if (s.expr)
    s.expr = translateExpr(s.expr, dc, ds);
  return s;
}

class Link {
  errorCollector;
  defines;
  lto;
  data = new SparseByteArray;
  orig = new SparseByteArray;
  romImage;
  baseRom;
  baseOffset = 0;
  exports = new Map;
  chunks = [];
  symbols = [];
  debugSymbols = undefined;
  written = new IntervalSet;
  free = new FreeSpace;
  rawSegments = new Map;
  segments = new Map;
  segmentOrder = [];
  rawModules = [];
  anonDeclarationOrder = [];
  hasNamedSegment = false;
  segmentIndex = new Map;
  overlapGroups;
  segmentMappings = new Set;
  segmentWindows = new Map;
  segmentFree = new Map;
  segmentLoad = new Map;
  segmentExtent = new Map;
  segmentAlign = new Map;
  fileBases = new Map([["%O", 0]]);
  ramBases = new Map;
  segmentArea = new Map;
  outputs = new Map;
  config;
  configSegments = new Set;
  targetSegments = [];
  objectExports = new Set;
  moduleRanges = [];
  watches = [];
  placed = [];
  initialReport = "";
  missingImports = new Set;
  constructor(errorCollector, defines = new Map, lto = true) {
    this.errorCollector = errorCollector;
    this.defines = defines;
    this.lto = lto;
  }
  fail(msg, at) {
    if (!this.errorCollector)
      fail(msg, at);
    this.errorCollector.add("error", msg, at?.source);
    throw new RecoverableError(msg, at?.source);
  }
  collect(items, fn, onError) {
    for (const item of items) {
      try {
        fn(item);
      } catch (err) {
        if (err instanceof FatalError || !this.errorCollector)
          throw err;
        if (err instanceof SourceError) {
          if (!err.recorded)
            this.errorCollector.addFromException(err);
          onError?.(item);
          continue;
        }
        throw err;
      }
    }
  }
  stopIfFailed(what) {
    if (!this.errorCollector?.hasErrors())
      return;
    const message = `cannot continue linking, ${what}`;
    this.errorCollector.add("info", message);
    const err = new FatalError(message);
    err.recorded = true;
    throw err;
  }
  errorCount() {
    return this.errorCollector?.getMessages().filter((m) => m.level === "error").length ?? 0;
  }
  base(data, offset = 0) {
    this.data.set(offset, data);
    this.orig.set(offset, data);
    this.baseRom = data;
    this.baseOffset = offset;
  }
  mergeRomPatches() {
    const modules = this.rawModules;
    if (!modules.some((m) => m.romPatch)) {
      this.romImage = this.baseRom;
      return;
    }
    const collector = this.errorCollector;
    const hex = (n) => n.toString(16).padStart(4, "0");
    const base = this.baseRom ?? new Uint8Array(0);
    const length = modules.reduce((n, m) => Math.max(n, m.romPatch?.newLength ?? 0), base.length);
    const rom = new Uint8Array(length);
    rom.set(base);
    const owner = new Int32Array(length).fill(-1);
    const nameOf = (i) => modules[i].name ?? `module #${i + 1}`;
    modules.forEach((module, index) => {
      for (const { offset, data } of module.romPatch?.runs ?? []) {
        let conflict;
        const report = () => {
          if (!conflict)
            return;
          const { start, end, prev } = conflict;
          const where = end - start === 1 ? `$${hex(start)}` : `$${hex(start)}-$${hex(end - 1)}`;
          collector?.add("warning", `Base ROM ${where} written by both ${nameOf(prev)} and ${nameOf(index)}; ` + `using ${nameOf(index)}`, module.name ? { file: module.name, line: 1, column: 0 } : undefined);
          conflict = undefined;
        };
        for (let i = 0;i < data.length; i++) {
          const at = offset + i;
          const prev = owner[at];
          if (prev >= 0 && rom[at] !== data[i]) {
            if (conflict && conflict.prev === prev && conflict.end === at) {
              conflict.end++;
            } else {
              report();
              conflict = { start: at, end: at + 1, prev };
            }
          } else {
            report();
          }
          rom[at] = data[i];
          owner[at] = index;
        }
        report();
      }
    });
    this.data.set(this.baseOffset, rom);
    this.romImage = rom;
  }
  loadModuleInto(file) {
    const dc = this.chunks.length;
    const ds = this.symbols.length;
    const dd = this.debugSymbols?.length ?? 0;
    for (const segment of file.segments || []) {
      this.addRawSegment(segment);
    }
    for (const chunk of file.chunks || []) {
      const lc = new LinkChunk(this, this.chunks.length, chunk, dc, ds, file.debug);
      this.chunks.push(lc);
    }
    for (const symbol of file.symbols || []) {
      this.symbols.push(translateSymbol(symbol, dc, ds));
    }
    if (file.debugSymbols) {
      if (!this.debugSymbols)
        this.debugSymbols = [];
      for (const symbol of file.debugSymbols) {
        this.debugSymbols.push(translateSymbol(symbol, dc, ds));
      }
    }
    this.moduleRanges.push({
      chunkStart: dc,
      chunkCount: file.chunks?.length ?? 0,
      symbolStart: ds,
      symbolCount: file.symbols?.length ?? 0,
      debugStart: dd,
      debugCount: file.debugSymbols?.length ?? 0
    });
  }
  readFile(file) {
    this.loadModuleInto(file);
    this.rawModules.push(file);
  }
  rebuildFromModules() {
    this.chunks = [];
    this.symbols = [];
    this.debugSymbols = undefined;
    this.rawSegments = new Map;
    this.moduleRanges = [];
    if (this.config) {
      for (const segment of lowerLinkerConfig(this.config, this.objectExports, this.defines)) {
        this.addRawSegment(segment);
      }
    }
    for (const file of this.rawModules) {
      this.loadModuleInto(file);
    }
    for (const segment of this.targetSegments) {
      this.addRawSegment(segment);
    }
  }
  resolveLink(expr) {
    if (expr.op === ".orig" && expr.args?.length === 1) {
      const child = expr.args[0];
      const offset = child.meta?.offset;
      if (offset != null) {
        const num = this.orig.get(offset + child.num);
        if (num != null)
          return { op: "num", num };
      }
    } else if (expr.op === "num" && expr.meta?.chunk != null) {
      const meta = expr.meta;
      const chunk = this.chunks[meta.chunk];
      if (chunk.org !== meta.org || chunk.segment?.bank !== meta.bank || chunk.offset !== meta.offset) {
        const meta2 = {
          org: chunk.org,
          offset: chunk.offset,
          bank: chunk.segment?.bank
        };
        if (chunk.isMirrored) {
          meta2.bank = 0;
        }
        expr = evaluate({ ...expr, meta: { ...meta, ...meta2 } });
      }
    }
    return expr;
  }
  resolveExprOrNull(expr) {
    expr = traverse(expr, (e, rec) => {
      return this.resolveLink(evaluate(rec(e)));
    });
    if (expr.op === "num" && !expr.meta?.rel)
      return expr.num;
    return null;
  }
  checkAssert(a) {
    const source = a.expr.source;
    const val = this.resolveExprOrNull(a.expr);
    if (val == null) {
      this.errorCollector?.add("warning", `Cannot evaluate assertion`, source);
      return;
    }
    if (val)
      return;
    const pc = a.pc != null ? ` (PC=$${a.pc.toString(16)})` : "";
    const msg = `${a.message ?? "Assertion failed"}${pc}`;
    const soft = a.action === "warning" || a.action === "ldwarning";
    if (!this.errorCollector) {
      if (!soft)
        this.fail(msg, a.expr);
      return;
    }
    this.errorCollector.add(soft ? "warning" : "error", msg, source);
  }
  link(signal) {
    this.checkAnonMode();
    this.mergeRomPatches();
    for (const name of [...this.segmentOrder, ...this.rawSegments.keys()]) {
      if (this.segmentIndex.has(name))
        continue;
      this.segmentIndex.set(name, this.segmentIndex.size);
    }
    this.segmentOrder = [...this.segmentIndex.keys()];
    const unknownSegments = new Set;
    this.collect(this.chunks, (chunk) => {
      const name = chunk.segments.find((s) => !this.rawSegments.has(s) && !unknownSegments.has(s));
      if (name == null)
        return;
      unknownSegments.add(name);
      this.fail(`Unknown segment: ${name}`, chunk.at());
    });
    const merged = new Map;
    this.mergeSegments(merged);
    this.expandComposites(merged);
    this.stopIfFailed("the segment lists are not valid");
    this.lowerSegments(merged);
    if (this.lateAssemblyPass(merged, signal)) {
      this.stopIfFailed("the late assembly pass failed");
      this.lowerSegments(merged);
    }
    this.collect(merged, ([name, s]) => {
      const ramBase = LinkSegment.isRamSegment(s) ? this.ramBase(this.segmentArea.get(name) ?? name) : 0;
      this.segments.set(name, new LinkSegment(s, this.segmentWindows.get(name), ramBase));
    });
    this.stopIfFailed("the segment layout is not valid");
    for (const [name, s] of this.segments) {
      const explicit = this.explicitFree(name);
      if (explicit.length) {
        for (const [start, end] of explicit) {
          if (end <= start)
            continue;
          this.free.add(start + s.delta, end + s.delta);
          this.data.splice(start + s.delta, end - start);
        }
      } else if (s.size > 0 && (s.isRam || s.fill != null || this.configSegments.has(name))) {
        const ranges = this.segmentFree.get(name) ?? [[s.memory, s.memory + s.size]];
        for (const [start, end] of ranges) {
          if (end > start)
            this.free.add(start + s.delta, end + s.delta);
        }
      }
    }
    this.collect(this.chunks, (chunk) => chunk.fixedPlacements());
    this.collect(this.chunks, (chunk) => chunk.resolveMirrorOrg());
    if (DEBUG2) {
      this.initialReport = `Initial:
${this.report(true)}`;
    }
    this.collect(this.symbols.keys(), (i) => {
      const symbol = this.symbols[i];
      if (!symbol.expr)
        this.fail(`Symbol ${i} never resolved`);
      if (symbol.export != null) {
        this.exports.set(symbol.export, i);
      }
    });
    this.defineConfigSymbols(this.defineSegmentSymbols(merged));
    this.collect(this.symbols, (symbol) => {
      symbol.expr = this.resolveSymbols(symbol.expr);
    });
    for (const chunk of this.chunks) {
      this.collect([...chunk.subs, ...chunk.selfSubs], (sub) => {
        sub.expr = this.resolveSymbols(sub.expr);
      });
      this.collect(chunk.asserts, (a) => {
        a.expr = this.resolveSymbols(a.expr);
      });
    }
    this.stopIfFailed("some symbols could not be resolved");
    this.collect(this.chunks, (c) => c.resolveSubs(true));
    this.collect(this.chunks, (chunk) => chunk.resolveSubs());
    const candidates = new Map;
    const eligibleCount = new Map;
    for (const chunk of this.chunks) {
      if (chunk.org != null)
        continue;
      const eligible = this.eligibleSegments(chunk);
      const [first] = eligible;
      if (first == null)
        continue;
      eligibleCount.set(chunk, eligible.length);
      const key = this.overlapGroup(first);
      let list = candidates.get(key);
      if (!list)
        candidates.set(key, list = []);
      list.push(chunk);
    }
    const errorsBeforePlacement = this.errorCount();
    for (const name of this.segmentOrder) {
      const list = candidates.get(name);
      if (!list)
        continue;
      list.sort((a, b) => eligibleCount.get(a) - eligibleCount.get(b) || b.size - a.size || a.index - b.index);
      this.collect(list, (chunk) => {
        if (signal?.aborted)
          throw new FatalError("Compilation cancelled");
        chunk.resolveSubs();
        this.placeChunk(chunk);
      });
    }
    this.collect(this.chunks, (chunk) => {
      if (chunk.org != null || this.eligibleSegments(chunk).length)
        return;
      this.placeChunk(chunk);
    });
    if (this.errorCount() > errorsBeforePlacement + 1) {
      this.errorCollector.add("info", `a chunk that could not be placed leaves ${""}its space free, which may lead to spurious error reports`);
    }
    const patch = this.output("%O");
    for (const [_name, seg] of this.segments) {
      if (seg.isRam)
        continue;
      if (seg.fill != null) {
        const buf = new Uint8Array(new ArrayBuffer(seg.size));
        buf.fill(seg.fill);
        this.output(seg.out).set(seg.offset - this.fileBase(seg.out || "%O"), buf);
      }
    }
    for (const c of this.chunks) {
      this.collect(c.asserts, (a) => this.checkAssert(a));
    }
    this.stopIfFailed("the module did not link cleanly");
    for (const c of this.chunks) {
      if (c.overlaps)
        continue;
      if (c.offset == null) {
        impossible(`Chunk ${c.name ?? c.index} was never placed`);
      }
      for (const { segment, offset, size } of c.pieces) {
        if (segment.isRam)
          continue;
        const base = this.fileBase(segment.out || "%O");
        this.output(segment.out).set(offset - base, this.data.slice(offset, offset + size));
      }
    }
    if (DEBUG2)
      console.log(this.report(true));
    return patch;
  }
  mergeSegments(target) {
    target.clear();
    for (const [name, segments] of this.rawSegments) {
      let s = { ...segments[0] };
      for (let i = 1;i < segments.length; i++) {
        s = Segment.merge(s, segments[i]);
      }
      target.set(name, s);
    }
  }
  lateAssemblyPass(merged, signal) {
    if (!this.lto)
      return false;
    if (!this.rawModules.some((m) => m.lateAssembly?.sizeQueries.length || m.lateAssembly?.condQueries.length))
      return false;
    const linkEnv = buildLinkTimeEnv(this.rawModules, merged);
    const noMessages = this.rawModules.map(() => []);
    const replayed = replayModules(this.rawModules, noMessages, linkEnv, signal, { errorLimit: this.errorCollector?.limit });
    if (this.errorCollector)
      this.errorCollector.merge(replayed.messages);
    let didReplace = false;
    for (let i = 0;i < this.rawModules.length; i++) {
      const module = replayed.modules[i];
      if (module === this.rawModules[i])
        continue;
      this.rawModules[i] = module;
      didReplace = true;
    }
    if (!didReplace)
      return false;
    this.rebuildFromModules();
    this.mergeSegments(merged);
    this.expandComposites(merged);
    return true;
  }
  expandComposites(merged) {
    const referenced = new Set(this.chunks.flatMap((c) => [...c.segments]));
    const declared = new Set;
    const composites = new Map;
    for (const [name, seg] of merged) {
      const members = seg.mirror ?? seg.pool;
      if (!members)
        continue;
      merged.delete(name);
      declared.add(name);
      if (seg.optional && !referenced.has(name))
        continue;
      const at = this.segmentSource(name);
      composites.set(name, {
        members,
        placement: seg.mirror ? "all" : "any",
        ...at ? { at } : {}
      });
    }
    if (!declared.size)
      return;
    this.collect(composites, ([name, { members, at }]) => {
      for (const member of members) {
        if (composites.has(member)) {
          this.fail(`Segment ${name} lists ${member}, which is itself a ${""}segment list. Nesting is not supported`, at);
        }
        if (!merged.has(member)) {
          this.fail(`Segment ${name} lists unknown segment ${member}`, at);
        }
      }
    });
    this.collect(this.chunks, (chunk) => {
      const named = chunk.segments.filter((s) => composites.has(s));
      if (!named.length)
        return;
      if (chunk.segments.length > 1) {
        this.fail(`Segment list ${named.join(", ")} cannot be combined with ${""}other segments: ${chunk.segments.join(", ")}`, chunk.at());
      }
      const composite = composites.get(named[0]);
      chunk.segments = composite.members;
      chunk.placement = composite.placement;
    });
    this.segmentOrder = this.segmentOrder.filter((n) => !declared.has(n));
    for (const name of declared) {
      this.segmentIndex.delete(name);
      this.rawSegments.delete(name);
    }
  }
  segmentSource(name) {
    for (const chunk of this.chunks) {
      if (chunk.segments.includes(name))
        return chunk.at();
    }
    return;
  }
  lowerSegments(merged) {
    const order = this.segmentOrder.filter((name) => merged.has(name));
    const needsLowering = (s) => s.load != null || s.run != null;
    const contents = new Map;
    const referenced = new Set;
    for (const chunk of this.chunks) {
      const eligible = this.eligibleSegments(chunk);
      for (const name of eligible)
        referenced.add(name);
      const [first] = eligible;
      if (first == null)
        continue;
      let list = contents.get(first);
      if (!list)
        contents.set(first, list = []);
      list.push(chunk);
    }
    const measure = (chunks) => {
      let cursor = 0;
      const bySize = [...chunks].sort((a, b) => b.size - a.size || a.index - b.index);
      for (const c of bySize) {
        if (c.org != null)
          continue;
        cursor = alignUp(cursor, c.align ?? 1) + c.size;
      }
      return cursor;
    };
    const sizes = new Map;
    const aligns = new Map;
    const selfSizes = new Map;
    const unmapped = [];
    const drop = (name) => {
      merged.delete(name);
      const i = unmapped.findIndex((s) => s.name === name);
      if (i >= 0)
        unmapped.splice(i, 1);
    };
    this.collect(order, (name) => {
      const seg = merged.get(name);
      if (!needsLowering(seg))
        return;
      const chunks = contents.get(name) ?? [];
      if (seg.optional && !referenced.has(name)) {
        merged.delete(name);
        return;
      }
      unmapped.push(seg);
      let align = seg.align ?? 1;
      for (const c of chunks)
        align = Math.max(align, c.align ?? 1);
      aligns.set(name, align);
      this.segmentAlign.set(name, align);
      let size = seg.size ?? measure(chunks);
      for (const c of chunks) {
        if (c.org == null)
          continue;
        if (seg.memory != null) {
          size = Math.max(size, c.org + c.size - seg.memory);
        } else if (seg.size == null) {
          size += c.size;
        }
      }
      sizes.set(name, size);
    }, drop);
    for (const name of order) {
      const seg = merged.get(name);
      if (!seg || needsLowering(seg))
        continue;
      let align = seg.align ?? 1;
      const own = contents.get(name) ?? [];
      for (const c of own)
        align = Math.max(align, c.align ?? 1);
      this.segmentAlign.set(name, align);
      const size = measure(own);
      if (size)
        selfSizes.set(name, size);
    }
    const claims = new Map;
    const cursor = new Map;
    const runs = new Map;
    const loads = new Map;
    const mappingOf = (seg, which) => {
      const name = which === "load" ? seg.load ?? seg.run : seg.run ?? seg.load;
      const mapped = merged.get(name);
      if (!mapped) {
        this.fail(`Segment ${seg.name} has ${which} "${name}", which is not a segment`);
      }
      if (needsLowering(mapped)) {
        this.fail(`Segment ${seg.name} has ${which} "${name}", which is already mapped to memory`);
      }
      this.segmentMappings.add(name);
      return mapped;
    };
    const claimsOf = (name) => {
      let list = claims.get(name);
      if (!list)
        claims.set(name, list = []);
      return list;
    };
    const addClaim = (list, start, end, owner) => {
      let i = list.length;
      while (i > 0 && list[i - 1][0] > start)
        i--;
      list.splice(i, 0, [start, end, owner]);
    };
    const claimedEnd = (seg) => {
      let end = 0;
      for (const c of claims.get(seg.name) ?? [])
        end = Math.max(end, c[1]);
      return end && end - (seg.memory ?? 0);
    };
    const nextFree = (mapped, size, align) => {
      const list = claims.get(mapped.name) ?? [];
      let start = alignUp(cursor.get(mapped.name) ?? mapped.memory ?? 0, align);
      for (let i = 0;i < list.length; i++) {
        const [s, e] = list[i];
        if (s < start + size && start < e) {
          start = alignUp(e, align);
          i = -1;
        }
      }
      return start;
    };
    const allocate = (seg, mapped, size, align, memory) => {
      const base = mapped.memory ?? 0;
      const list = claimsOf(mapped.name);
      const start = memory ?? nextFree(mapped, size, align);
      if (start < base || mapped.size != null && start + size > base + mapped.size) {
        this.fail(`Segment ${seg.name} ($${size.toString(16)} bytes at $${start.toString(16)}) does not fit in ${mapped.name}`);
      }
      if (memory != null) {
        const hit = list.find(([s, e, owner]) => owner && s < start + size && start < e);
        if (hit) {
          this.fail(`Segment ${seg.name} ($${size.toString(16)} bytes at $${start.toString(16)}) overlaps ${hit[2]} ($${hit[0].toString(16)}-$${(hit[1] - 1).toString(16)}) in ${mapped.name}`);
        }
      } else {
        let from = cursor.get(mapped.name) ?? base;
        for (const [, e] of list) {
          if (e <= start)
            from = Math.max(from, e);
        }
        if (from < start)
          addClaim(list, from, start, "");
        cursor.set(mapped.name, start + size);
      }
      if (size > 0)
        addClaim(list, start, start + size, seg.name);
      return start;
    };
    const backing = new Set(unmapped.flatMap((s) => [s.load, s.run].filter((n) => n != null)));
    const allocOrder = this.allocationOrder(order);
    const inConfig = new Set(this.config?.segments.map((s) => s.name));
    const isSourceLowered = (n) => {
      const s = merged.get(n);
      return s != null && needsLowering(s) && !inConfig.has(n);
    };
    const loweredFirst = [
      ...allocOrder.filter(isSourceLowered),
      ...allocOrder.filter((n) => !isSourceLowered(n))
    ];
    this.collect(loweredFirst, (name) => {
      const seg = merged.get(name);
      if (!seg)
        return;
      if (!needsLowering(seg)) {
        const size = selfSizes.get(name);
        const align = this.segmentAlign.get(name) ?? 1;
        if (!size || !backing.has(name))
          return;
        const base = seg.memory ?? 0;
        const start = nextFree(seg, size, align);
        const room = base + (seg.size ?? 0) - start;
        if (room <= 0)
          return;
        allocate(seg, seg, Math.min(size, room), align);
        return;
      }
      const size = sizes.get(seg.name);
      const align = aligns.get(seg.name);
      const runSeg = mappingOf(seg, "run");
      const loadSeg = mappingOf(seg, "load");
      if (seg.memory == null && seg.size == null && seg.align == null && seg.alignLoad == null && seg.loadMem == null && this.isPatched(runSeg) && this.isPatched(loadSeg)) {
        sizes.set(seg.name, Math.min(runSeg.size ?? 0, loadSeg.size ?? 0));
        runs.set(seg.name, runSeg.memory ?? 0);
        loads.set(seg.name, loadSeg.memory ?? 0);
        this.segmentLoad.set(seg.name, loadSeg.memory ?? 0);
        this.segmentExtent.set(seg.name, size);
        return;
      }
      if (seg.loadMem != null) {
        if (loadSeg === runSeg) {
          this.fail(`Segment ${seg.name} has :loadmem but loads and runs in ${loadSeg.name}; use :mem instead`);
        }
        if (seg.alignLoad != null && seg.loadMem % seg.alignLoad) {
          this.fail(`Segment ${seg.name} :loadmem $${seg.loadMem.toString(16)} is not aligned to :alignload $${seg.alignLoad.toString(16)}`);
        }
      }
      const run = allocate(seg, runSeg, size, align, seg.memory);
      const load = loadSeg === runSeg ? run : allocate(seg, loadSeg, size, seg.alignLoad ?? align, seg.loadMem);
      runs.set(seg.name, run);
      loads.set(seg.name, load);
      this.segmentLoad.set(seg.name, load);
      this.segmentExtent.set(seg.name, size);
    }, drop);
    for (const name of order) {
      const seg = merged.get(name);
      if (!seg || needsLowering(seg))
        continue;
      let extent = claimedEnd(seg);
      for (const c of contents.get(name) ?? []) {
        if (c.org == null)
          continue;
        extent = Math.max(extent, c.org + c.size - (seg.memory ?? 0));
      }
      this.segmentExtent.set(name, Math.min(extent, seg.size ?? extent));
    }
    const fileLocations = new Map;
    for (const name of order) {
      const seg = merged.get(name);
      if (!seg || needsLowering(seg) || seg.bss)
        continue;
      if (!Segment.isAnon(seg) && seg.out == null && seg.offset == null)
        continue;
      const file = seg.out || "%O";
      const base = this.fileBase(file);
      let cursor = fileLocations.get(file) ?? 0;
      if (seg.offset != null)
        cursor = seg.offset;
      seg.offset = base + cursor;
      const extent = seg.fill == null && this.segmentMappings.has(name) && !referenced.has(name) ? claimedEnd(seg) : seg.size ?? 0;
      fileLocations.set(file, cursor + extent);
    }
    this.collect([...unmapped], (seg) => {
      const runSeg = mappingOf(seg, "run");
      const loadSeg = mappingOf(seg, "load");
      const emits = !loadSeg.bss && loadSeg.offset != null;
      seg.size = sizes.get(seg.name);
      seg.memory = runs.get(seg.name);
      if (emits) {
        seg.offset = loadSeg.offset + (loads.get(seg.name) - (loadSeg.memory ?? 0));
      }
      seg.out = seg.out ?? loadSeg.out;
      seg.bank = seg.bank ?? loadSeg.bank;
      seg.fill = seg.fill ?? loadSeg.fill;
      seg.addressing = seg.addressing ?? runSeg.addressing;
      seg.bss = seg.bss ?? !emits;
      this.segmentArea.set(seg.name, runSeg.name);
    }, (seg) => drop(seg.name));
    for (const name of order) {
      const seg = merged.get(name);
      if (!seg || needsLowering(seg))
        continue;
      const memory = seg.memory ?? 0;
      const size = seg.size ?? 0;
      const windows = [];
      let lo = 0;
      for (const [s, e, owner] of claims.get(name) ?? []) {
        if (owner === name)
          continue;
        if (s - memory > lo)
          windows.push([lo, s - memory]);
        lo = Math.max(lo, e - memory);
      }
      if (lo < size)
        windows.push([lo, size]);
      if (this.segmentMappings.has(name))
        this.segmentWindows.set(name, windows);
      this.segmentFree.set(name, windows.map(([s, e]) => [memory + s, memory + e]));
    }
  }
  explicitFree(name) {
    return (this.rawSegments.get(name) ?? []).flatMap((seg) => seg.free ?? []);
  }
  isPatched(seg) {
    const ranges = this.explicitFree(seg.name).filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
    if (!ranges.length)
      return false;
    let covered = seg.memory ?? 0;
    for (const [start, end] of ranges) {
      if (start > covered)
        return true;
      covered = Math.max(covered, end);
    }
    return covered < (seg.memory ?? 0) + (seg.size ?? 0);
  }
  allocationOrder(order) {
    if (!this.config)
      return order;
    const seen = new Set;
    const out = [];
    for (const name of [...this.config.segments.map((s) => s.name), ...order]) {
      if (seen.has(name) || !order.includes(name))
        continue;
      seen.add(name);
      out.push(name);
    }
    return out;
  }
  fileBase(file) {
    let base = this.fileBases.get(file);
    if (base == null) {
      base = Link.FILE_SPACE * this.fileBases.size;
      if (base >= LinkSegment.RAM_OFFSET)
        impossible(`Too many output files`);
      this.fileBases.set(file, base);
    }
    return base;
  }
  static FILE_SPACE = 16777216;
  ramBase(area) {
    let base = this.ramBases.get(area);
    if (base == null) {
      base = LinkSegment.RAM_OFFSET + Link.RAM_SPACE * this.ramBases.size;
      this.ramBases.set(area, base);
    }
    return base;
  }
  static RAM_SPACE = 65536;
  output(file) {
    const name = file || "%O";
    let out = this.outputs.get(name);
    if (!out)
      this.outputs.set(name, out = new SparseByteArray);
    return out;
  }
  outputFiles() {
    const out = [];
    for (const [name, bytes] of this.outputs) {
      if (name === "%O")
        continue;
      const data = new Uint8Array(bytes.length);
      bytes.apply(data);
      out.push({ name, data });
    }
    return out;
  }
  addLinkerSymbol(name, value) {
    if (this.exports.has(name))
      return false;
    this.exports.set(name, this.symbols.length);
    this.symbols.push({ export: name, expr: { op: "num", num: value } });
    return true;
  }
  defineSegmentSymbols(merged) {
    const defined = new Map;
    const define = (name, value) => {
      if (this.addLinkerSymbol(name, value))
        defined.set(name, value);
    };
    for (const name of this.segmentOrder) {
      const seg = merged.get(name);
      if (!seg?.define)
        continue;
      const start = seg.memory ?? 0;
      const size = seg.size ?? 0;
      define(`__${name}_START__`, start);
      define(`__${name}_RUN__`, start);
      define(`__${name}_LOAD__`, this.segmentLoad.get(name) ?? start);
      define(`__${name}_SIZE__`, size);
      define(`__${name}_LAST__`, start + (this.segmentExtent.get(name) ?? size));
      if (!seg.bss && seg.offset != null) {
        define(`__${name}_FILEOFFS__`, seg.offset);
      }
    }
    return defined;
  }
  defineConfigSymbols(segmentSymbols) {
    if (!this.config)
      return;
    const symbols = new Map([
      ...configSymbols(this.config, this.objectExports, this.defines),
      ...segmentSymbols
    ]);
    this.collect(this.config.symbols, (sym) => {
      if (sym.type === "import") {
        if (!this.exports.has(sym.name)) {
          this.fail(`Symbol ${sym.name} is imported by the linker config but is ${""}never exported`);
        }
        return;
      }
      if (this.exports.has(sym.name))
        return;
      const define = this.defines.get(sym.name);
      const value = define ?? resolveCfgExpr(sym.value, symbols, `Value of '${sym.name}'`);
      symbols.set(sym.name, value);
      this.addLinkerSymbol(sym.name, value);
    });
  }
  eligibleSegments(chunk) {
    let segments = chunk.segments.length ? chunk.segments.filter((name) => this.rawSegments.has(name)) : chunk.segments;
    if (!chunk.segments.length && !this.anonDeclarationOrder.length) {
      for (const [name, raw] of this.rawSegments) {
        if (raw.some((s) => s.default)) {
          chunk.segments = segments = [name];
          break;
        }
      }
    }
    if (segments.length < 2)
      return segments;
    const order = (name) => this.segmentIndex.get(name) ?? this.segmentIndex.size;
    return [...segments].sort((a, b) => order(a) - order(b));
  }
  overlapGroup(name) {
    if (!this.overlapGroups) {
      this.overlapGroups = new Map;
      const spans = [];
      for (const [n, s] of this.segments) {
        if (s.size <= 0)
          continue;
        const base = s.isRam ? s.memory + s.delta : s.offset;
        spans.push([n, base, base + s.size]);
      }
      spans.sort((a, b) => a[1] - b[1] || a[2] - b[2]);
      const order = (n) => this.segmentIndex.get(n) ?? this.segmentIndex.size;
      let rep;
      let reach = -Infinity;
      for (const [n, lo, hi] of spans) {
        if (rep == null || lo >= reach) {
          rep = n;
          reach = hi;
        } else {
          reach = Math.max(reach, hi);
          if (order(n) < order(rep))
            rep = n;
        }
        this.overlapGroups.set(n, rep);
      }
      for (const [n, r] of this.overlapGroups) {
        this.overlapGroups.set(n, this.overlapGroups.get(r) ?? r);
      }
    }
    return this.overlapGroups.get(name) ?? name;
  }
  placeSpill(chunk, segments) {
    const size = chunk.size;
    const align = chunk.align ?? 1;
    let best;
    for (const a of segments) {
      if (a.size <= 0)
        continue;
      const aEnd = a.memory + a.delta + a.size;
      const b = segments.find((s) => s.memory === a.memory + a.size && s.windows[0]?.[0] === 0 && s.isRam === a.isRam);
      if (!b)
        continue;
      const last = a.windows[a.windows.length - 1];
      if (!last || last[1] !== a.size)
        continue;
      const r = this.free.rangeAt(aEnd - 1);
      if (!r)
        continue;
      const lo = Math.max(r[0], a.memory + a.delta + last[0]);
      const start = alignUp(lo - a.delta, align) + a.delta;
      const n = aEnd - start;
      if (n <= 0 || n >= size)
        continue;
      const bStart = b.memory + b.delta;
      const rb = this.free.rangeAt(bStart);
      if (size - n > b.windows[0][1] || !rb || rb[1] < bStart + size - n)
        continue;
      if (!best || n > best.n)
        best = { head: a, tail: b, start, n };
    }
    if (!best)
      return false;
    chunk.placeSplit(best.start - best.head.delta, best.head, best.tail);
    return true;
  }
  placeChunk(chunk) {
    if (chunk.org != null)
      return;
    const size = chunk.size;
    const align = chunk.align ?? 1;
    const segments = this.eligibleSegments(chunk);
    if (!size && segments.length) {
      const segment = this.segment(segments[0]);
      chunk.place(segment.memory, segment);
      chunk.overlaps = true;
      return;
    }
    if (align === 1 && size < 256 && !chunk.subs.size && !chunk.selfSubs.size && !chunk.overlaps) {
      let pattern;
      for (const name of segments) {
        const segment = this.segment(name);
        if (!segment.dedupe)
          continue;
        if (segment.isRam)
          continue;
        pattern ??= this.data.pattern(chunk.data);
        const start = segment.offset;
        const end = start + segment.size;
        const index = pattern.search(start, end);
        if (index < 0)
          continue;
        chunk.place(index - segment.delta, segment);
        chunk.overlaps = true;
        return;
      }
    }
    for (let i = 0;i < segments.length; ) {
      const group = this.overlapGroup(segments[i]);
      let best;
      const slack = { value: Infinity };
      while (i < segments.length && this.overlapGroup(segments[i]) === group) {
        const segment = this.segment(segments[i++]);
        const base = segment.isRam ? segment.memory + segment.delta : segment.offset;
        const windows = segment.windows;
        for (let w = 0;w < windows.length; w++) {
          const found = this.free.bestFit(base + windows[w][0], base + windows[w][1], size, align, segment.delta, slack);
          if (found == null)
            continue;
          if (best == null || slack.value < best.slack) {
            best = { segment, start: found, slack: slack.value };
          }
        }
      }
      if (best) {
        chunk.place(best.start - best.segment.delta, best.segment);
        return;
      }
    }
    if (this.placeSpill(chunk, segments.map((n) => this.segment(n))))
      return;
    if (DEBUG2)
      console.log(`Initial:
${this.initialReport}`);
    const name = chunk.name ? `${chunk.name} ` : "";
    const aligned = align > 1 ? `${align}-byte aligned ` : "";
    if (!segments.length && this.anonDeclarationOrder.length) {
      this.fail(`${size}-byte chunk ${name}was emitted before the first ` + `.segment. All bytes must be placed in a segment`, chunk.at());
    }
    const where = segments.length ? segments.map((n) => this.segmentLabel(n)).join(", ") : "(no segment)";
    this.fail(`Could not find space for ${aligned}${size}-byte chunk ${name}in ${where}`, chunk.at());
  }
  segment(name) {
    return this.segments.get(name) ?? impossible(`Segment not found with name: ${name}`);
  }
  resolveSymbols(expr) {
    return traverse(expr, (e, rec) => {
      while (e.op === "im" || e.op === "sym") {
        if (e.op === "im") {
          const name = e.sym;
          const imported = this.exports.get(name);
          if (imported == null) {
            const msg = `Symbol never exported ${name}`;
            if (this.missingImports.has(name))
              throw new RecoverableError(msg);
            this.missingImports.add(name);
            this.fail(msg, e.source ? e : expr);
          }
          e = this.symbols[imported].expr;
        } else {
          if (e.num == null)
            throw new Error(`Symbol not global`);
          e = this.symbols[e.num].expr;
        }
      }
      return evaluate(rec(e));
    });
  }
  setConfig(cfg) {
    const exported = new Set;
    for (const symbol of this.symbols) {
      if (symbol.export != null)
        exported.add(symbol.export);
    }
    this.config = cfg;
    this.objectExports = exported;
    for (const segment of lowerLinkerConfig(cfg, exported, this.defines)) {
      this.addRawSegment(segment);
      this.configSegments.add(segment.name);
      this.segmentOrder.push(segment.name);
    }
  }
  setTargetSegments(segments) {
    this.targetSegments = segments;
    for (const segment of segments)
      this.addRawSegment(segment);
  }
  addRawSegment(segment) {
    if (Segment.isAnon(segment)) {
      if (this.rawSegments.has(segment.name)) {
        this.fail(`Duplicate anonymous segment ${segment.name}; ` + `this is a js65 bug, please report it`);
      }
      this.anonDeclarationOrder.push(segment.name);
    } else {
      this.hasNamedSegment = true;
    }
    let list = this.rawSegments.get(segment.name);
    if (!list)
      this.rawSegments.set(segment.name, list = []);
    list.push(segment);
  }
  checkAnonMode(what) {
    if (!this.anonDeclarationOrder.length)
      return;
    if (what)
      this.fail(`${what} cannot be combined with anonymous segments`);
    if (this.hasNamedSegment) {
      this.fail(`Anonymous segments cannot be combined with named segments.`);
    }
  }
  buildExports() {
    const map = new Map;
    for (const symbol of this.symbols) {
      if (!symbol.export)
        continue;
      const e = traverse(symbol.expr, (e, rec) => {
        return this.resolveLink(evaluate(rec(e)));
      });
      if (e.op !== "num")
        throw new Error(`never resolved: ${symbol.export}`);
      const value = e.num;
      const out = { value };
      if (e.meta?.offset != null && e.meta.org != null) {
        const k = value - e.meta.org;
        const chunk = e.meta.chunk != null ? this.chunks[e.meta.chunk] : undefined;
        out.offset = chunk?.fileOffsetAt(k) ?? e.meta.offset + k;
      }
      if (e.meta?.bank != null)
        out.bank = e.meta.bank;
      if (e.meta?.chunk != null && this.chunks[e.meta.chunk]?.isMirrored) {
        this.errorCollector?.add("warning", `.bank value is 0 for mirrored data`, symbol.expr?.source);
      }
      map.set(symbol.export, out);
    }
    return map;
  }
  segmentLabel(name) {
    if (!Segment.isAnon(name))
      return name;
    const memory = this.segments.get(name)?.memory ?? 0;
    return anonSegmentLabel(name, memory);
  }
  segmentReport() {
    if (!this.segments.size)
      return "";
    const hex = (n, w = 6) => n.toString(16).toUpperCase().padStart(w, "0");
    const occupied = new IntervalSet;
    for (const [offset, , piece] of this.placed) {
      occupied.add(offset, offset + piece.size);
      const area = this.segmentArea.get(piece.segment.name);
      const run = area != null ? this.segments.get(area) : undefined;
      if (run && run.delta !== piece.segment.delta) {
        const at = offset - piece.segment.delta + run.delta;
        occupied.add(at, at + piece.size);
      }
    }
    const usedBytes = (s) => {
      const lo = s.memory + s.delta;
      const hi = lo + s.size;
      let total = 0;
      for (const [start, end] of occupied.tail(lo)) {
        if (start >= hi)
          break;
        total += Math.min(end, hi) - start;
      }
      return total;
    };
    const rows = this.segmentOrder.filter((n) => this.segments.has(n)).map((n) => [n, this.segmentLabel(n)]);
    const width = Math.max(20, ...rows.map(([, label]) => label.length));
    let out = `Segment list:
-------------
`;
    out += `${"Name".padEnd(width)}   Start     End    Size    Used  Align  FileOffs  File
`;
    out += "-".repeat(width + 56) + `
`;
    for (const [name, label] of rows) {
      const s = this.segments.get(name);
      const end = s.memory + Math.max(s.size - 1, 0);
      const file = s.isRam ? "" : s.out || "%O";
      const offs = s.isRam ? "      " : hex(s.offset - (this.fileBases.get(file) ?? 0));
      out += `${label.padEnd(width)}  ${hex(s.memory)}  ${hex(end)}  ${hex(s.size)}  ${hex(usedBytes(s))}  ${hex(this.segmentAlign.get(name) ?? 1, 5)}  ${offs}  ${file}
`;
    }
    return out + `
`;
  }
  dbgLink(outputName) {
    const named = new Set;
    for (const m of this.rawModules) {
      for (const s of m.segments ?? [])
        named.add(s.name);
      for (const c of m.chunks ?? [])
        for (const s of c.segments)
          named.add(s);
    }
    const extent = new Map;
    for (const [, , p] of this.placed) {
      const end = p.offset - p.segment.delta - p.segment.memory + p.size;
      extent.set(p.segment.name, Math.max(extent.get(p.segment.name) ?? 0, end));
    }
    const names = this.segmentOrder.filter((n) => this.segments.has(n) && (named.has(n) || extent.has(n)));
    const segIds = new Map(names.map((n, i) => [n, i]));
    const segments = names.map((name) => {
      const s = this.segments.get(name);
      const def = this.config?.segments.find((d) => d.name === name);
      const out = {
        name,
        start: s.memory,
        size: extent.get(name) ?? 0,
        addrsize: ["default", "zeropage", "absolute", "far", "long"][s.addressing] ?? "absolute",
        readOnly: def ? def.declaredType === "ro" || def.declaredType === "overwrite" : !s.isRam
      };
      if (!s.isRam) {
        const file = s.out || "%O";
        out.oname = file.replace(/%O/g, outputName);
        out.ooffs = s.offset - this.fileBase(file);
      }
      return out;
    });
    const modules = this.rawModules.map((module, i) => {
      const { chunkStart, chunkCount } = this.moduleRanges[i];
      const pieces = this.chunks.slice(chunkStart, chunkStart + chunkCount).map((c) => c.pieces.map((p) => ({
        seg: segIds.get(p.segment.name),
        start: p.start,
        size: p.size,
        segStart: p.offset - p.segment.delta - p.segment.memory
      })));
      return { module, pieces };
    });
    return {
      segments,
      modules,
      resolve: (module, expr) => {
        const { chunkStart, symbolStart } = this.moduleRanges[module];
        const translated = translateExpr(expr, chunkStart, symbolStart);
        const e = this.resolveQuietly(translated);
        if (e?.op !== "num" || e.meta?.rel)
          return;
        const value = e.num;
        const index = this.segmentChunk(translated)?.chunk;
        const chunk = index != null ? this.chunks[index] : undefined;
        if (!chunk?.pieces.length)
          return { value };
        const k = value - (chunk.org ?? 0);
        const p = chunk.pieces.find((p) => k >= p.start && k < p.start + p.size) ?? chunk.pieces[0];
        return { value, seg: segIds.get(p.segment.name) };
      },
      exporter: (name) => {
        const i = this.exports.get(name);
        if (i == null)
          return;
        const m = this.moduleRanges.findIndex((r) => i >= r.symbolStart && i < r.symbolStart + r.symbolCount);
        return m >= 0 ? m : undefined;
      }
    };
  }
  segmentChunk(expr, depth = 0) {
    if (depth > 64)
      return;
    const [a, b] = expr.args ?? [];
    switch (expr.op) {
      case "im":
      case "sym": {
        const i = expr.op === "im" ? this.exports.get(expr.sym) : expr.num;
        const next = i != null ? this.symbols[i]?.expr : undefined;
        return next && this.segmentChunk(next, depth + 1);
      }
      case "num":
        return { chunk: expr.meta?.chunk };
      case "+": {
        if (!b)
          break;
        const l = this.segmentChunk(a, depth + 1);
        const r = this.segmentChunk(b, depth + 1);
        if (!l || !r || l.chunk != null && r.chunk != null)
          return;
        return { chunk: l.chunk ?? r.chunk };
      }
      case "-": {
        if (!b)
          break;
        const l = this.segmentChunk(a, depth + 1);
        const r = this.segmentChunk(b, depth + 1);
        if (!l || !r)
          return;
        if (r.chunk == null)
          return l;
        return l.chunk === r.chunk ? {} : undefined;
      }
    }
    for (const arg of expr.args ?? []) {
      const s = this.segmentChunk(arg, depth + 1);
      if (!s || s.chunk != null)
        return;
    }
    return {};
  }
  resolveQuietly(expr) {
    let missing = false;
    const out = traverse(expr, (e, rec) => {
      while (e.op === "im" || e.op === "sym") {
        const i = e.op === "im" ? this.exports.get(e.sym) : e.num;
        const next = i != null ? this.symbols[i]?.expr : undefined;
        if (!next) {
          missing = true;
          return e;
        }
        e = next;
      }
      return this.resolveLink(evaluate(rec(e)));
    });
    return missing ? undefined : out;
  }
  report(verbose = false) {
    let out = this.segmentReport();
    for (const [s, e] of this.free) {
      out += `Free: ${s.toString(16)}..${e.toString(16)}: ${e - s} bytes
`;
    }
    if (verbose) {
      for (const [s, c, piece] of this.placed) {
        const name = c.name ?? `Chunk ${c.index}`;
        const end = s + piece.size;
        out += `${s.toString(16).padStart(5, "0")} .. ${end.toString(16).padStart(5, "0")}: ${name} (${end - s} bytes)
`;
      }
    }
    return out;
  }
}
var DEBUG2 = false;
var NO_THROW = false;
var QUIET = false;

// src/validate_modules.ts
class ValidationError extends Error {
}
function fail5(path, msg) {
  throw new ValidationError(`${path}: ${msg}`);
}
function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function reqNumber(v, path) {
  if (typeof v !== "number" || Number.isNaN(v))
    fail5(path, "expected number");
  return v;
}
function reqString(v, path) {
  if (typeof v !== "string")
    fail5(path, "expected string");
  return v;
}
function optNumber(v, path) {
  return v === undefined ? undefined : reqNumber(v, path);
}
function optString(v, path) {
  return v === undefined ? undefined : reqString(v, path);
}
function optBoolean(v, path) {
  if (v === undefined)
    return;
  if (typeof v !== "boolean")
    fail5(path, "expected boolean");
  return v;
}
function reqArray(v, path) {
  if (!Array.isArray(v))
    fail5(path, "expected array");
  return v;
}
function validateSourceInfo(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const out = {
    file: reqString(v.file, `${path}.file`),
    line: reqNumber(v.line, `${path}.line`),
    column: reqNumber(v.column, `${path}.column`)
  };
  const ident = optString(v.ident, `${path}.ident`);
  if (ident !== undefined)
    out.ident = ident;
  if (v.parent !== undefined)
    out.parent = validateSourceInfo(v.parent, `${path}.parent`);
  return out;
}
function validateMeta(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const out = {};
  const rel = optBoolean(v.rel, `${path}.rel`);
  if (rel !== undefined)
    out.rel = rel;
  const chunk = optNumber(v.chunk, `${path}.chunk`);
  if (chunk !== undefined)
    out.chunk = chunk;
  const org = optNumber(v.org, `${path}.org`);
  if (org !== undefined)
    out.org = org;
  const bank = optNumber(v.bank, `${path}.bank`);
  if (bank !== undefined)
    out.bank = bank;
  const offset = optNumber(v.offset, `${path}.offset`);
  if (offset !== undefined)
    out.offset = offset;
  const size = optNumber(v.size, `${path}.size`);
  if (size !== undefined)
    out.size = size;
  const branch = optBoolean(v.branch, `${path}.branch`);
  if (branch !== undefined)
    out.branch = branch;
  return out;
}
function validateExpr(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const out = { op: reqString(v.op, `${path}.op`) };
  const num = optNumber(v.num, `${path}.num`);
  if (num !== undefined)
    out.num = num;
  const str = optString(v.str, `${path}.str`);
  if (str !== undefined)
    out.str = str;
  const sym = optString(v.sym, `${path}.sym`);
  if (sym !== undefined)
    out.sym = sym;
  if (v.meta !== undefined)
    out.meta = validateMeta(v.meta, `${path}.meta`);
  if (v.source !== undefined)
    out.source = validateSourceInfo(v.source, `${path}.source`);
  if (v.args !== undefined) {
    const arr = reqArray(v.args, `${path}.args`);
    out.args = arr.map((e, i) => validateExpr(e, `${path}.args[${i}]`));
  }
  return out;
}
var STRING_TOKS = new Set(["ident", "op", "cs", "str"]);
var NULL_TOKS = new Set(["lb", "lc", "lp", "rb", "rc", "rp", "eol", "eof"]);
function validateSubstitution(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const out = {
    offset: reqNumber(v.offset, `${path}.offset`),
    size: reqNumber(v.size, `${path}.size`),
    expr: validateExpr(v.expr, `${path}.expr`)
  };
  const forceRange = optBoolean(v.forceRange, `${path}.forceRange`);
  if (forceRange !== undefined)
    out.forceRange = forceRange;
  return out;
}
function validateAssertion(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const action = reqString(v.action, `${path}.action`);
  if (!ASSERT_ACTIONS2.has(action)) {
    fail5(`${path}.action`, `expected one of warning|error|ldwarning|lderror`);
  }
  const out = {
    expr: validateExpr(v.expr, `${path}.expr`),
    action
  };
  const message = optString(v.message, `${path}.message`);
  if (message !== undefined)
    out.message = message;
  const pc = optNumber(v.pc, `${path}.pc`);
  if (pc !== undefined)
    out.pc = pc;
  return out;
}
function validateSymbol(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const out = {};
  const exp = optString(v.export, `${path}.export`);
  if (exp !== undefined)
    out.export = exp;
  if (v.expr !== undefined)
    out.expr = validateExpr(v.expr, `${path}.expr`);
  return out;
}
function reqIndex(v, limit, path) {
  const n = reqNumber(v, path);
  if (!Number.isInteger(n) || n < 0 || n >= limit)
    fail5(path, `expected index below ${limit}`);
  return n;
}
function optIndexList(v, limit, path) {
  if (v === undefined)
    return;
  return reqArray(v, path).map((x, i) => reqIndex(x, limit, `${path}[${i}]`));
}
var ADDR_SIZES = new Set(["default", "zeropage", "absolute", "far", "long"]);
var SYM_KINDS = new Set(["lab", "equ", "imp"]);
var SCOPE_TYPES = new Set(["scope", "struct", "enum"]);
var CSYM_CLASSES = new Set(["auto", "reg", "static", "ext"]);
function validateDebug(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const files = reqArray(v.files, `${path}.files`).map((f, i) => {
    const p = `${path}.files[${i}]`;
    if (!isObject(f))
      fail5(p, "expected object");
    return {
      name: reqString(f.name, `${p}.name`),
      size: reqNumber(f.size, `${p}.size`),
      mtime: reqNumber(f.mtime, `${p}.mtime`)
    };
  });
  const lines = reqArray(v.lines, `${path}.lines`).map((l, i) => {
    const p = `${path}.lines[${i}]`;
    if (!isObject(l))
      fail5(p, "expected object");
    return {
      file: reqIndex(l.file, files.length, `${p}.file`),
      line: reqNumber(l.line, `${p}.line`),
      type: reqNumber(l.type, `${p}.type`),
      count: reqNumber(l.count, `${p}.count`)
    };
  });
  const lineSets = reqArray(v.lineSets, `${path}.lineSets`).map((set, i) => reqArray(set, `${path}.lineSets[${i}]`).map((x, j) => reqIndex(x, lines.length, `${path}.lineSets[${i}][${j}]`)));
  const types = reqArray(v.types, `${path}.types`).map((t, i) => reqString(t, `${path}.types[${i}]`));
  const scopes = reqArray(v.scopes, `${path}.scopes`).map((sc, i) => {
    const p = `${path}.scopes[${i}]`;
    if (!isObject(sc))
      fail5(p, "expected object");
    const out = {
      name: reqString(sc.name, `${p}.name`),
      size: reqNumber(sc.size, `${p}.size`),
      runs: reqArray(sc.runs, `${p}.runs`).map((r, j) => {
        const run = reqArray(r, `${p}.runs[${j}]`);
        if (run.length !== 3)
          fail5(`${p}.runs[${j}]`, "expected [chunk, offset, size]");
        return [
          reqNumber(run[0], `${p}.runs[${j}][0]`),
          reqNumber(run[1], `${p}.runs[${j}][1]`),
          reqNumber(run[2], `${p}.runs[${j}][2]`)
        ];
      })
    };
    if (sc.type !== undefined) {
      const t = reqString(sc.type, `${p}.type`);
      if (!SCOPE_TYPES.has(t))
        fail5(`${p}.type`, "expected one of scope|struct|enum");
      out.type = t;
    }
    if (sc.parent !== undefined)
      out.parent = reqIndex(sc.parent, i, `${p}.parent`);
    return out;
  });
  const syms = reqArray(v.syms, `${path}.syms`).map((sy, i) => {
    const p = `${path}.syms[${i}]`;
    if (!isObject(sy))
      fail5(p, "expected object");
    const addrsize = reqString(sy.addrsize, `${p}.addrsize`);
    if (!ADDR_SIZES.has(addrsize))
      fail5(`${p}.addrsize`, "unknown address size");
    const kind = reqString(sy.kind, `${p}.kind`);
    if (!SYM_KINDS.has(kind))
      fail5(`${p}.kind`, "expected one of lab|equ|imp");
    const out = {
      name: reqString(sy.name, `${p}.name`),
      addrsize,
      kind
    };
    if (sy.scope === undefined === (sy.parent === undefined)) {
      fail5(p, "expected exactly one of scope or parent");
    }
    if (sy.scope !== undefined)
      out.scope = reqIndex(sy.scope, scopes.length, `${p}.scope`);
    if (sy.parent !== undefined)
      out.parent = reqIndex(sy.parent, i, `${p}.parent`);
    const size = optNumber(sy.size, `${p}.size`);
    if (size !== undefined)
      out.size = size;
    if (sy.expr !== undefined)
      out.expr = validateExpr(sy.expr, `${p}.expr`);
    if (optBoolean(sy.export, `${p}.export`))
      out.export = true;
    const defs = optIndexList(sy.defs, lines.length, `${p}.defs`);
    if (defs)
      out.defs = defs;
    const refs = optIndexList(sy.refs, lines.length, `${p}.refs`);
    if (refs)
      out.refs = refs;
    return out;
  });
  scopes.forEach((sc, i) => {
    const label = v.scopes[i].label;
    if (label !== undefined)
      sc.label = reqIndex(label, syms.length, `${path}.scopes[${i}].label`);
  });
  const hll = reqArray(v.hll, `${path}.hll`).map((c, i) => {
    const p = `${path}.hll[${i}]`;
    if (!isObject(c))
      fail5(p, "expected object");
    const sc = reqString(c.sc, `${p}.sc`);
    if (!CSYM_CLASSES.has(sc))
      fail5(`${p}.sc`, "expected one of auto|reg|static|ext");
    const out = {
      name: reqString(c.name, `${p}.name`),
      scope: reqIndex(c.scope, scopes.length, `${p}.scope`),
      type: reqString(c.type, `${p}.type`),
      sc
    };
    const offs = optNumber(c.offs, `${p}.offs`);
    if (offs !== undefined)
      out.offs = offs;
    if (c.sym !== undefined)
      out.sym = reqIndex(c.sym, syms.length, `${p}.sym`);
    return out;
  });
  const out = { files, lines, lineSets, types, scopes, syms, hll };
  if (optBoolean(v.lineOnly, `${path}.lineOnly`))
    out.lineOnly = true;
  return out;
}
function validateDebugRuns(v, path) {
  return reqArray(v, path).map((r, i) => {
    const run = reqArray(r, `${path}[${i}]`);
    if (run.length !== 4)
      fail5(`${path}[${i}]`, "expected [lineSet, offset, size, type]");
    return [
      reqNumber(run[0], `${path}[${i}][0]`),
      reqNumber(run[1], `${path}[${i}][1]`),
      reqNumber(run[2], `${path}[${i}][2]`),
      reqNumber(run[3], `${path}[${i}][3]`)
    ];
  });
}
function mapEntries(v, path) {
  if (v instanceof Map)
    return [...v];
  return reqArray(v, path).map((e, i) => {
    const pair = reqArray(e, `${path}[${i}]`);
    if (pair.length !== 2)
      fail5(`${path}[${i}]`, "expected [key, value] pair");
    return [pair[0], pair[1]];
  });
}
var ASSERT_ACTIONS2 = new Set(["warning", "error", "ldwarning", "lderror"]);
var OVERWRITE_MODES = new Set(["forbid", "allow", "require"]);
var PLACEMENT_MODES = new Set(["declarationOrder", "any", "all"]);
function validateChunk(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  if (typeof v.data !== "string")
    fail5(`${path}.data`, "expected base64 string");
  let data;
  try {
    data = new Base64().decode(v.data);
  } catch {
    fail5(`${path}.data`, "invalid base64");
  }
  const segments = reqArray(v.segments, `${path}.segments`).map((s, i) => reqString(s, `${path}.segments[${i}]`));
  const out = { segments, data };
  const name = optString(v.name, `${path}.name`);
  if (name !== undefined)
    out.name = name;
  const org = optNumber(v.org, `${path}.org`);
  if (org !== undefined)
    out.org = org;
  const align = optNumber(v.align, `${path}.align`);
  if (align !== undefined)
    out.align = align;
  if (v.subs !== undefined) {
    out.subs = reqArray(v.subs, `${path}.subs`).map((s, i) => validateSubstitution(s, `${path}.subs[${i}]`));
  }
  if (v.asserts !== undefined) {
    out.asserts = reqArray(v.asserts, `${path}.asserts`).map((a, i) => validateAssertion(a, `${path}.asserts[${i}]`));
  }
  if (v.overwrite !== undefined) {
    const ow = reqString(v.overwrite, `${path}.overwrite`);
    if (!OVERWRITE_MODES.has(ow))
      fail5(`${path}.overwrite`, `expected one of forbid|allow|require`);
    out.overwrite = ow;
  }
  if (v.source !== undefined)
    out.source = validateSourceInfo(v.source, `${path}.source`);
  if (v.labelIndex !== undefined) {
    const m = new Map;
    for (const [k, val] of mapEntries(v.labelIndex, `${path}.labelIndex`)) {
      m.set(reqString(k, `${path}.labelIndex.key`), reqNumber(val, `${path}.labelIndex.value`));
    }
    out.labelIndex = m;
  }
  if (v.debugRuns !== undefined)
    out.debugRuns = validateDebugRuns(v.debugRuns, `${path}.debugRuns`);
  if (v.placement !== undefined) {
    const p = reqString(v.placement, `${path}.placement`);
    if (!PLACEMENT_MODES.has(p))
      fail5(`${path}.placement`, `expected one of ${[...PLACEMENT_MODES].join("|")}`);
    out.placement = p;
  }
  return out;
}
function validateSegment(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const out = { name: reqString(v.name, `${path}.name`) };
  const bank = optNumber(v.bank, `${path}.bank`);
  if (bank !== undefined)
    out.bank = bank;
  const size = optNumber(v.size, `${path}.size`);
  if (size !== undefined)
    out.size = size;
  const offset = optNumber(v.offset, `${path}.offset`);
  if (offset !== undefined)
    out.offset = offset;
  const memory = optNumber(v.memory, `${path}.memory`);
  if (memory !== undefined)
    out.memory = memory;
  const addressing = optNumber(v.addressing, `${path}.addressing`);
  if (addressing !== undefined)
    out.addressing = addressing;
  const fill = optNumber(v.fill, `${path}.fill`);
  if (fill !== undefined)
    out.fill = fill;
  const o = optString(v.out, `${path}.out`);
  if (o !== undefined)
    out.out = o;
  const load = optString(v.load, `${path}.load`);
  if (load !== undefined)
    out.load = load;
  const run = optString(v.run, `${path}.run`);
  if (run !== undefined)
    out.run = run;
  const align = optNumber(v.align, `${path}.align`);
  if (align !== undefined)
    out.align = align;
  const alignLoad = optNumber(v.alignLoad, `${path}.alignLoad`);
  if (alignLoad !== undefined)
    out.alignLoad = alignLoad;
  const loadMem = optNumber(v.loadMem, `${path}.loadMem`);
  if (loadMem !== undefined)
    out.loadMem = loadMem;
  const bss = optBoolean(v.bss, `${path}.bss`);
  if (bss !== undefined)
    out.bss = bss;
  const define = optBoolean(v.define, `${path}.define`);
  if (define !== undefined)
    out.define = define;
  const optional = optBoolean(v.optional, `${path}.optional`);
  if (optional !== undefined)
    out.optional = optional;
  const dedupe = optBoolean(v.dedupe, `${path}.dedupe`);
  if (dedupe !== undefined)
    out.dedupe = dedupe;
  const def = optBoolean(v.default, `${path}.default`);
  if (def !== undefined)
    out.default = def;
  if (v.free !== undefined) {
    out.free = reqArray(v.free, `${path}.free`).map((row, i) => {
      const r = reqArray(row, `${path}.free[${i}]`);
      return r.map((n, j) => reqNumber(n, `${path}.free[${i}][${j}]`));
    });
  }
  for (const key of ["mirror", "pool"]) {
    if (v[key] === undefined)
      continue;
    out[key] = reqArray(v[key], `${path}.${key}`).map((s, i) => reqString(s, `${path}.${key}[${i}]`));
  }
  return out;
}
function validateLateAssemblySizeQuery(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const name = reqString(v.name, `${path}.name`);
  const guess = reqNumber(v.guess, `${path}.guess`);
  if (guess !== 1 && guess !== 2)
    fail5(`${path}.guess`, "expected 1 or 2");
  const out = { name, guess };
  if (v.source !== undefined)
    out.source = validateSourceInfo(v.source, `${path}.source`);
  return out;
}
function validateAutoImport(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const out = { name: reqString(v.name, `${path}.name`) };
  if (v.source !== undefined)
    out.source = validateSourceInfo(v.source, `${path}.source`);
  return out;
}
function validateLateAssemblyCondQuery(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const out = {};
  if (v.source !== undefined)
    out.source = validateSourceInfo(v.source, `${path}.source`);
  return out;
}
function validateAssemblerOptions(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  return v;
}
function validateGlobalKinds(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const out = {};
  for (const [name, kind] of Object.entries(v)) {
    if (kind !== "import" && kind !== "export")
      fail5(`${path}.${name}`, `expected 'import' or 'export'`);
    out[name] = kind;
  }
  return out;
}
function validateLateAssembly(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const sizeQueries = reqArray(v.sizeQueries, `${path}.sizeQueries`).map((q, i) => validateLateAssemblySizeQuery(q, `${path}.sizeQueries[${i}]`));
  const condQueries = reqArray(v.condQueries, `${path}.condQueries`).map((q, i) => validateLateAssemblyCondQuery(q, `${path}.condQueries[${i}]`));
  const globalKinds = validateGlobalKinds(v.globalKinds, `${path}.globalKinds`);
  const opts = validateAssemblerOptions(v.opts, `${path}.opts`);
  const out = { sizeQueries, condQueries, globalKinds, opts };
  if (v.input !== undefined)
    out.input = validateLateAssemblyInput(v.input, `${path}.input`);
  if (v.files !== undefined)
    out.files = validateSourceLog(v.files, `${path}.files`);
  if (v.defines !== undefined)
    out.defines = validateDefines(v.defines, `${path}.defines`);
  return out;
}
function validateLateAssemblyInput(v, path) {
  const input = validateInput(v, path);
  if (input.type === "module")
    fail5(`${path}.type`, "expected source or actions");
  if (input.name === undefined)
    fail5(`${path}.name`, "expected string");
  return { ...input, name: input.name };
}
function validateResolvedFile(v, path, content) {
  if (!isObject(v))
    fail5(path, "expected object");
  return {
    baseIndex: reqOffset(v.baseIndex, `${path}.baseIndex`),
    content: content(v.content, `${path}.content`)
  };
}
function validateFileMap(v, path, content) {
  return new Map(reqArray(v, path).map((entry, i) => {
    const pair = reqArray(entry, `${path}[${i}]`);
    if (pair.length !== 2)
      fail5(`${path}[${i}]`, "expected [key, file]");
    return [
      reqString(pair[0], `${path}[${i}][0]`),
      validateResolvedFile(pair[1], `${path}[${i}][1]`, content)
    ];
  }));
}
function reqBase64(v, path) {
  if (typeof v !== "string")
    fail5(path, "expected base64 string");
  try {
    return new Base64().decode(v);
  } catch {
    fail5(path, "invalid base64");
  }
}
function validateSourceLog(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const log = {
    text: validateFileMap(v.text, `${path}.text`, reqString),
    binary: validateFileMap(v.binary, `${path}.binary`, reqBase64)
  };
  if (v.missing !== undefined) {
    log.missing = reqArray(v.missing, `${path}.missing`).map((k, i) => reqString(k, `${path}.missing[${i}]`));
  }
  return log;
}
function validateDefines(v, path) {
  return reqArray(v, path).map((d, i) => {
    const p = `${path}[${i}]`;
    if (!isObject(d))
      fail5(p, "expected object");
    return {
      name: reqString(d.name, `${p}.name`),
      value: reqString(d.value, `${p}.value`)
    };
  });
}
function reqOffset(v, path) {
  const n = reqNumber(v, path);
  if (!Number.isInteger(n) || n < 0)
    fail5(path, "expected non-negative integer");
  return n;
}
function validateRomPatch(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const newLength = reqOffset(v.newLength, `${path}.newLength`);
  let end = 0;
  const runs = reqArray(v.runs, `${path}.runs`).map((r, i) => {
    const runPath = `${path}.runs[${i}]`;
    if (!isObject(r))
      fail5(runPath, "expected object");
    const offset = reqOffset(r.offset, `${runPath}.offset`);
    if (typeof r.data !== "string")
      fail5(`${runPath}.data`, "expected base64 string");
    let data;
    try {
      data = new Base64().decode(r.data);
    } catch {
      fail5(`${runPath}.data`, "invalid base64");
    }
    if (offset < end)
      fail5(runPath, "runs must be sorted and non-overlapping");
    end = offset + data.length;
    if (end > newLength)
      fail5(runPath, `run ends at ${end}, past newLength ${newLength}`);
    return { offset, data };
  });
  return { newLength, runs };
}
function validateJsPost(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const file = reqString(v.file, `${path}.file`);
  const prelude = reqArray(v.prelude, `${path}.prelude`).map((p, i) => {
    const srcPath = `${path}.prelude[${i}]`;
    if (!isObject(p))
      fail5(srcPath, "expected object");
    const out = {
      file: reqString(p.file, `${srcPath}.file`),
      firstLine: reqNumber(p.firstLine, `${srcPath}.firstLine`)
    };
    const module = optString(p.module, `${srcPath}.module`);
    if (module !== undefined)
      out.module = module;
    const text = optString(p.text, `${srcPath}.text`);
    if (text !== undefined)
      out.text = text;
    if (module === undefined === (text === undefined))
      fail5(srcPath, "expected one of module or text");
    return out;
  });
  const blocks = reqArray(v.blocks, `${path}.blocks`).map((b, i) => {
    const blockPath = `${path}.blocks[${i}]`;
    if (!isObject(b))
      fail5(blockPath, "expected object");
    return { line: reqNumber(b.line, `${blockPath}.line`), body: reqString(b.body, `${blockPath}.body`) };
  });
  if (!blocks.length)
    fail5(`${path}.blocks`, "expected at least one block");
  return { file, prelude, blocks };
}
function parseModule(obj) {
  try {
    if (!isObject(obj))
      fail5("module", "expected object");
    const out = {};
    const version = optNumber(obj.version, "module.version");
    if (version !== undefined)
      out.version = version;
    const name = optString(obj.name, "module.name");
    if (name !== undefined)
      out.name = name;
    if (obj.chunks !== undefined) {
      out.chunks = reqArray(obj.chunks, "module.chunks").map((c, i) => validateChunk(c, `module.chunks[${i}]`));
    }
    if (obj.symbols !== undefined) {
      out.symbols = reqArray(obj.symbols, "module.symbols").map((s, i) => validateSymbol(s, `module.symbols[${i}]`));
    }
    if (obj.segments !== undefined) {
      out.segments = reqArray(obj.segments, "module.segments").map((s, i) => validateSegment(s, `module.segments[${i}]`));
    }
    if (obj.debugSymbols !== undefined) {
      out.debugSymbols = reqArray(obj.debugSymbols, "module.debugSymbols").map((s, i) => validateSymbol(s, `module.debugSymbols[${i}]`));
    }
    if (obj.debug !== undefined) {
      out.debug = validateDebug(obj.debug, "module.debug");
      const { lineSets, types } = out.debug;
      out.chunks?.forEach((c, i) => c.debugRuns?.forEach((r, j) => {
        const at = `module.chunks[${i}].debugRuns[${j}]`;
        reqIndex(r[0], lineSets.length, `${at}[0]`);
        if (r[3] !== DEBUG_RUN_UNTYPED && r[3] !== DEBUG_RUN_CODE) {
          reqIndex(r[3], types.length, `${at}[3]`);
        }
      }));
    }
    if (obj.lateAssembly !== undefined) {
      out.lateAssembly = validateLateAssembly(obj.lateAssembly, "module.lateAssembly");
    }
    if (obj.autoImports !== undefined) {
      out.autoImports = reqArray(obj.autoImports, "module.autoImports").map((a, i) => validateAutoImport(a, `module.autoImports[${i}]`));
    }
    if (obj.romPatch !== undefined) {
      out.romPatch = validateRomPatch(obj.romPatch, "module.romPatch");
    }
    if (obj.jsPost !== undefined) {
      out.jsPost = validateJsPost(obj.jsPost, "module.jsPost");
    }
    return { ok: true, value: out };
  } catch (err) {
    if (err instanceof ValidationError)
      return { ok: false, error: err.message };
    throw err;
  }
}
function staleModuleVersion(m) {
  if (m.version === MODULE_FORMAT_VERSION)
    return;
  const got = m.version ?? "none";
  return `stale module format (got ${got}, need ${MODULE_FORMAT_VERSION}); rebuild the .o file`;
}
function validateActionSource(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  return {
    file: reqString(v.file, `${path}.file`),
    line: reqNumber(v.line, `${path}.line`)
  };
}
function validateByteList(v, path) {
  if (v instanceof Uint8Array)
    return Array.from(v);
  const arr = reqArray(v, path);
  return arr.map((e, i) => {
    if (typeof e === "number")
      return e;
    if (isObject(e))
      return validateExpr(e, `${path}[${i}]`);
    fail5(`${path}[${i}]`, "expected number or expression");
  });
}
function validateByteOrStringList(v, path) {
  if (v instanceof Uint8Array)
    return Array.from(v);
  const arr = reqArray(v, path);
  return arr.map((e, i) => {
    if (typeof e === "number" || typeof e === "string")
      return e;
    if (isObject(e))
      return validateExpr(e, `${path}[${i}]`);
    fail5(`${path}[${i}]`, "expected number, string literal, or expression");
  });
}
function validateStringList(v, path) {
  const arr = reqArray(v, path);
  return arr.map((e, i) => reqString(e, `${path}[${i}]`));
}
function validateNumberList(v, path) {
  if (v instanceof Uint8Array)
    return Array.from(v);
  const arr = reqArray(v, path);
  return arr.map((e, i) => reqNumber(e, `${path}[${i}]`));
}
function validateAction(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const action = reqString(v.action, `${path}.action`);
  const source = v.source === undefined ? undefined : validateActionSource(v.source, `${path}.source`);
  const withSource = (o) => source ? { ...o, source } : o;
  switch (action) {
    case "code":
      return withSource({
        action: "code",
        code: reqString(v.code, `${path}.code`),
        ...v.name !== undefined ? { name: reqString(v.name, `${path}.name`) } : {}
      });
    case "label":
      return withSource({ action: "label", label: reqString(v.label, `${path}.label`) });
    case "byte":
      return withSource({ action: "byte", bytes: validateByteOrStringList(v.bytes, `${path}.bytes`) });
    case "word":
      return withSource({ action: "word", words: validateByteList(v.words, `${path}.words`) });
    case "hibytes":
      return withSource({ action: "hibytes", values: validateByteList(v.values, `${path}.values`) });
    case "lobytes":
      return withSource({ action: "lobytes", values: validateByteList(v.values, `${path}.values`) });
    case "literal":
      return withSource({ action: "literal", values: validateByteOrStringList(v.values, `${path}.values`) });
    case "org":
      return withSource({
        action: "org",
        addr: reqNumber(v.addr, `${path}.addr`),
        ...v.name !== undefined ? { name: reqString(v.name, `${path}.name`) } : {}
      });
    case "segment": {
      const name = Array.isArray(v.name) ? v.name.map((n, i) => reqString(n, `${path}.name[${i}]`)) : reqString(v.name, `${path}.name`);
      return withSource({ action: "segment", name });
    }
    case "reloc":
      return withSource({
        action: "reloc",
        ...v.name !== undefined ? { name: reqString(v.name, `${path}.name`) } : {}
      });
    case "export":
      return withSource({ action: "export", name: reqString(v.name, `${path}.name`) });
    case "exportzp":
      return withSource({ action: "exportzp", names: validateStringList(v.names, `${path}.names`) });
    case "import":
      return withSource({ action: "import", names: validateStringList(v.names, `${path}.names`) });
    case "importzp":
      return withSource({ action: "importzp", names: validateStringList(v.names, `${path}.names`) });
    case "global":
      return withSource({ action: "global", names: validateStringList(v.names, `${path}.names`) });
    case "globalzp":
      return withSource({ action: "globalzp", names: validateStringList(v.names, `${path}.names`) });
    case "assign":
    case "set": {
      if (typeof v.value !== "number" && typeof v.value !== "string") {
        fail5(`${path}.value`, "expected number or string");
      }
      return withSource({
        action,
        name: reqString(v.name, `${path}.name`),
        value: v.value
      });
    }
    case "free":
      return withSource({ action: "free", size: reqNumber(v.size, `${path}.size`) });
    case "align": {
      const fill = optNumber(v.fill, `${path}.fill`);
      return withSource({
        action: "align",
        boundary: reqNumber(v.boundary, `${path}.boundary`),
        ...fill !== undefined ? { fill } : {}
      });
    }
    case "res": {
      const value = optNumber(v.value, `${path}.value`);
      return withSource({
        action: "res",
        count: reqNumber(v.count, `${path}.count`),
        ...value !== undefined ? { value } : {}
      });
    }
    case "charmap":
      return withSource({
        action: "charmap",
        code: reqNumber(v.code, `${path}.code`),
        target: reqNumber(v.target, `${path}.target`)
      });
    case "strmap":
      return withSource({
        action: "strmap",
        key: reqString(v.key, `${path}.key`),
        bytes: validateNumberList(v.bytes, `${path}.bytes`)
      });
    case "pushcharmap":
      return withSource({ action: "pushcharmap" });
    case "popcharmap":
      return withSource({ action: "popcharmap" });
    default:
      fail5(`${path}.action`, `unknown action "${action}"`);
  }
}
function validateInput(v, path) {
  if (!isObject(v))
    fail5(path, "expected object");
  const type = reqString(v.type, `${path}.type`);
  switch (type) {
    case "source":
      return {
        type: "source",
        code: reqString(v.code, `${path}.code`),
        name: reqString(v.name, `${path}.name`)
      };
    case "module": {
      const mod = parseModule(v.module);
      if (!mod.ok)
        fail5(`${path}.module`, mod.error);
      return { type: "module", module: mod.value };
    }
    case "actions": {
      const actions = reqArray(v.actions, `${path}.actions`).map((a, i) => validateAction(a, `${path}.actions[${i}]`));
      const name = optString(v.name, `${path}.name`);
      return name !== undefined ? { type: "actions", actions, name } : { type: "actions", actions };
    }
    default:
      fail5(`${path}.type`, `unknown input type "${type}"`);
  }
}
function parseInputs(arr) {
  const inputs = reqArray(arr, "inputs");
  return inputs.map((v, i) => validateInput(v, `inputs[${i}]`));
}
var OUTPUT_FORMATS = new Set(["binary", "ips", "object"]);
function validateOptions(v, path) {
  if (v === undefined)
    return {};
  if (!isObject(v))
    fail5(path, "expected object");
  const out = {};
  if (v.includePaths !== undefined) {
    out.includePaths = reqArray(v.includePaths, `${path}.includePaths`).map((s, i) => reqString(s, `${path}.includePaths[${i}]`));
  }
  if (v.defines !== undefined)
    out.defines = validateDefines(v.defines, `${path}.defines`);
  if (v.features !== undefined) {
    out.features = reqArray(v.features, `${path}.features`).map((s, i) => reqString(s, `${path}.features[${i}]`));
  }
  const flag = (key) => {
    const val = optBoolean(v[key], `${path}.${key}`);
    if (val !== undefined)
      out[key] = val;
  };
  flag("lineContinuations");
  flag("numberSeparators");
  flag("cComments");
  flag("allowBrackets");
  flag("allowJavascript");
  flag("labelsWithoutColons");
  flag("pcAssignment");
  flag("forceRange");
  flag("generateDbgFile");
  const outputName = optString(v.outputName, `${path}.outputName`);
  if (outputName !== undefined)
    out.outputName = outputName;
  const generateDebugInfo = optBoolean(v.generateDebugInfo, `${path}.generateDebugInfo`);
  if (generateDebugInfo !== undefined)
    out.generateDebugInfo = generateDebugInfo;
  const debugLevel = optNumber(v.debugLevel, `${path}.debugLevel`);
  if (debugLevel !== undefined)
    out.debugLevel = debugLevel;
  const target = optString(v.target, `${path}.target`);
  if (target !== undefined)
    out.target = target;
  const baseRomOffset = optNumber(v.baseRomOffset, `${path}.baseRomOffset`);
  if (baseRomOffset !== undefined)
    out.baseRomOffset = baseRomOffset;
  const linkerConfig = optString(v.linkerConfig, `${path}.linkerConfig`);
  if (linkerConfig !== undefined)
    out.linkerConfig = linkerConfig;
  const linkerConfigName = optString(v.linkerConfigName, `${path}.linkerConfigName`);
  if (linkerConfigName !== undefined)
    out.linkerConfigName = linkerConfigName;
  if (v.outputFormat !== undefined) {
    const fmt = reqString(v.outputFormat, `${path}.outputFormat`);
    if (!OUTPUT_FORMATS.has(fmt))
      fail5(`${path}.outputFormat`, "expected one of binary|ips|object");
    out.outputFormat = fmt;
  }
  return out;
}
function parseRequest(obj) {
  try {
    if (!isObject(obj))
      fail5("request", "expected object");
    const inputs = parseInputs(obj.inputs);
    const options = validateOptions(obj.options, "request.options");
    return { ok: true, value: { inputs, options } };
  } catch (err) {
    if (err instanceof ValidationError)
      return { ok: false, error: err.message };
    throw err;
  }
}
// src/libassembler.ts
function throwIfCancelled(signal) {
  if (signal?.aborted)
    throw new Error("Compilation cancelled");
}
function searchFiles(read) {
  return (bases, filename) => {
    for (let baseIndex = 0;baseIndex < bases.length; baseIndex++) {
      try {
        const content = read(bases[baseIndex], filename);
        if (content !== undefined)
          return { baseIndex, content };
      } catch (_e) {}
    }
    return;
  };
}
function assemble(inputs, options, callbacks, sourceContents, signal) {
  const modules = [];
  const moduleMessages = [];
  const allMessages = [];
  const jsActions = options?.jsActions ?? new JsActionTable;
  const baseOpts = {
    includePaths: options?.includePaths || [],
    binIncludePaths: options?.binIncludePaths,
    generateDebugInfo: options?.generateDebugInfo,
    lineContinuations: options?.lineContinuations ?? true,
    numberSeparators: options?.numberSeparators,
    cComments: options?.cComments,
    leadingDotInIdentifiers: options?.leadingDotInIdentifiers,
    lintPragmas: options?.lint?.enabled === false ? undefined : new LintPragmas,
    lint: options?.lint,
    jsActions
  };
  const baseAsmOpts = {
    generateDebugInfo: options?.generateDebugInfo,
    allowBrackets: options?.allowBrackets,
    labelsWithoutColons: options?.labelsWithoutColons,
    pcAssignment: options?.pcAssignment,
    forceRange: options?.forceRange,
    collectReferences: options?.collectReferences,
    symbolIndex: options?.symbolIndex,
    errorLimit: options?.errorLimit,
    lint: options?.lint,
    lto: options?.lto,
    refExtractor: options?.refExtractor,
    jsActions
  };
  const featureMessages = applyFeatures(options?.features ?? [], baseAsmOpts, baseOpts);
  allMessages.push(...featureMessages);
  if (featureMessages.some((m) => m.level === "error")) {
    return { success: false, modules, messages: allMessages, moduleMessages };
  }
  function moduleOpts(moduleName) {
    return { ...baseAsmOpts, moduleName, tokenizerOptions: { ...baseOpts } };
  }
  const setup = {
    defines: options?.defines,
    macroIndex: options?.macroIndex,
    inactiveRegionIndex: options?.inactiveRegionIndex,
    stage: (code, name) => jsPreprocess(code, name, {
      jsActions,
      allowJavascript: options?.allowJavascript,
      callbacks,
      includePaths: options?.includePaths,
      binIncludePaths: options?.binIncludePaths,
      baseRom: options?.baseRom
    })
  };
  let currentAssembler;
  try {
    for (let i = 0;i < inputs.length; i++) {
      throwIfCancelled(signal);
      const input = inputs[i];
      if (input.type === "module") {
        modules.push(input.module);
        moduleMessages.push([]);
        continue;
      }
      const named = input.type === "actions" ? { type: "actions", actions: input.actions, name: input.name ?? `module_${i}` } : input;
      const asm = currentAssembler = new Assembler(Cpu.P02, moduleOpts(named.name));
      const module = assembleInput(asm, named, setup, callbacks, sourceContents, signal);
      modules.push(module);
      moduleMessages.push([...asm.getMessages()]);
      allMessages.push(...asm.getMessages());
      currentAssembler = undefined;
    }
  } catch (err) {
    if (currentAssembler)
      allMessages.push(...currentAssembler.getMessages());
    pushException(allMessages, err);
    return { success: false, modules, messages: allMessages, moduleMessages };
  }
  const hasErrors = allMessages.some((m) => m.level === "error");
  return { success: !hasErrors, modules, messages: allMessages, moduleMessages };
}
function link(modules, options, outputFormat = "binary", sourceContents, messages = [], signal) {
  const allMessages = [...messages];
  const collector = new ErrorCollector;
  try {
    const posts = modules.flatMap((m) => m.jsPost ? [m.jsPost] : []);
    if (posts.length && !options?.allowJavascript) {
      throw new SourceError(`.jspostbegin requires --allow-javascript
` + `  JavaScript blocks execute arbitrary code at link time and are disabled by default.`, { file: posts[0].file, line: posts[0].blocks[0].line, column: 0 });
    }
    const linker = new Linker({
      target: options?.target,
      linkerConfig: options?.linkerConfig,
      linkerConfigName: options?.linkerConfigName,
      defines: options?.defines,
      errorCollector: collector,
      lto: options?.lto
    });
    if (options?.baseRom) {
      linker.base(options.baseRom, options.baseRomOffset ?? 0);
    }
    for (const module of modules) {
      linker.read(module);
    }
    const out = linker.link(signal);
    const extraOutputs = linker.outputFiles();
    const mlb = linker.getDebugInfo(sourceContents, options?.debugLevel ?? 0);
    const labelMap = linker.labelMap ?? new Map;
    let binaryData;
    if (outputFormat === "ips") {
      if (extraOutputs.length) {
        throw new Error(`Cannot write an IPS patch from a linker config with ${""}more than one output file (${extraOutputs.map((o) => o.name).join(", ")})`);
      }
      const patch = new SparseByteArray;
      for (const module of modules) {
        for (const { offset, data } of module.romPatch?.runs ?? [])
          patch.set(offset, data);
      }
      for (const [start, data] of out.chunks()) {
        patch.set(start, data);
      }
      let length = linker.romImage()?.length;
      if (posts.length) {
        const before = linker.romImage()?.slice() ?? new Uint8Array(out.length);
        out.apply(before);
        const after = jsPostprocess(posts, before, labelMap);
        if (after.length < before.length) {
          throw new Error(`rom was shrunk from ${before.length} to ${after.length} bytes, but an IPS patch can only grow the ROM`);
        }
        for (const { offset, data } of diffRom(before, after)?.runs ?? [])
          patch.set(offset, data);
        length = after.length;
      }
      binaryData = patch.toIpsPatch(options?.baseRom, length);
    } else {
      const data = linker.romImage() ?? new Uint8Array(out.length);
      out.apply(data);
      binaryData = posts.length ? jsPostprocess(posts, data, labelMap) : data;
    }
    const mapFile = options?.generateMapFile ? linker.report(true) : "";
    const dbg = options?.generateDbgFile ? linker.dbgFile(options.outputName ?? defaultOutputName(outputFormat)) : "";
    allMessages.push(...collector.getMessages());
    const hasErrors = allMessages.some((m) => m.level === "error");
    return {
      success: !hasErrors,
      data: binaryData,
      extraOutputs,
      dbg,
      mlb,
      mapFile,
      get exports() {
        return linker.exports();
      },
      messages: allMessages
    };
  } catch (err) {
    allMessages.push(...collector.getMessages());
    pushException(allMessages, err);
    return {
      success: false,
      data: new Uint8Array(0),
      extraOutputs: [],
      dbg: "",
      mlb: "",
      mapFile: "",
      exports: new Map,
      messages: allMessages
    };
  }
}
function defaultOutputName(format) {
  return format === "ips" ? "out.ips" : "out.nes";
}
function findOutput(result, type) {
  return result.outputs.find((o) => o.type === type);
}
function failureFromException(err, collected = []) {
  const messages = [...collected];
  pushException(messages, err);
  return {
    success: false,
    outputs: [],
    messages
  };
}
function pushException(messages, err) {
  if (err instanceof SourceError && err.recorded)
    return;
  messages.push(messageFromException(err));
}
function messageFromException(err) {
  return {
    level: "error",
    message: err instanceof Error ? err.message : String(err),
    source: err instanceof SourceError ? err.source : undefined,
    stack: err instanceof Error ? err.stack : undefined
  };
}
function serializeModule(m, keepDebugInfo = true) {
  const base64 = new Base64;
  return JSON.stringify({ ...m, version: MODULE_FORMAT_VERSION }, (k, v) => {
    if ((k === "data" || k === "content") && v instanceof Uint8Array) {
      return base64.encode(v);
    }
    if (!keepDebugInfo && (k === "source" || k === "debug" || k === "debugRuns")) {
      return;
    }
    if (v instanceof Map) {
      return [...v];
    }
    return v;
  });
}
var GZIP_MAGIC = [31, 139, 8];
function isGzip(data) {
  return data.length >= GZIP_MAGIC.length && GZIP_MAGIC.every((b, i) => data[i] === b);
}
function serializeObjectFile(m, keepDebugInfo = true) {
  const codec = gzipCodec();
  if (!codec)
    throw new Error("no gzip codec registered, The frontend must call setGzipCodec()");
  return codec.gzip(new TextEncoder().encode(serializeModule(m, keepDebugInfo)));
}
function deserializeObjectFile(data, name = "object file") {
  const codec = gzipCodec();
  if (!codec)
    throw new Error("no gzip codec registered. The frontend must call setGzipCodec()");
  let json;
  try {
    json = new TextDecoder().decode(codec.gunzip(data));
  } catch (err) {
    throw new Error(`${name}: could not decompress: ${err instanceof Error ? err.message : String(err)}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`${name}: not a valid object file (malformed JSON)`);
  }
  const validated = parseModule(parsed);
  if (!validated.ok)
    throw new Error(`${name}: not a valid object file: ${validated.error}`);
  const stale = staleModuleVersion(validated.value);
  if (stale)
    throw new Error(`${name}: ${stale}`);
  return validated.value;
}
function deserializeRequest(requestJson) {
  const base64 = new Base64;
  const parsed = JSON.parse(requestJson, (key, value) => (key === "bytes" || key === "words") && typeof value === "string" ? base64.decode(value) : value);
  const validated = parseRequest(parsed);
  if (!validated.ok)
    throw new Error(`Invalid compile request: ${validated.error}`);
  return validated.value;
}
function compile2(inputs, options = {}, callbacks, baseRom, signal) {
  const base64 = new Base64;
  let collected = [];
  try {
    throwIfCancelled(signal);
    const asmOpts = {
      includePaths: options.includePaths,
      binIncludePaths: options.binIncludePaths,
      generateDebugInfo: options.generateDebugInfo,
      defines: options.defines,
      features: options.features,
      allowJavascript: options.allowJavascript,
      baseRom,
      allowBrackets: options.allowBrackets,
      labelsWithoutColons: options.labelsWithoutColons,
      pcAssignment: options.pcAssignment,
      forceRange: options.forceRange,
      cComments: options.cComments,
      lineContinuations: options.lineContinuations,
      numberSeparators: options.numberSeparators,
      leadingDotInIdentifiers: options.leadingDotInIdentifiers,
      lint: options.lint,
      lto: options.lto
    };
    const linkerOpts = {
      target: options.target,
      baseRom,
      baseRomOffset: options.baseRomOffset,
      defines: options.defines,
      debugLevel: options.debugLevel,
      generateMapFile: options.generateMapFile,
      generateDbgFile: options.generateDbgFile,
      outputName: options.outputName,
      linkerConfig: options.linkerConfig,
      linkerConfigName: options.linkerConfigName,
      allowJavascript: options.allowJavascript,
      lto: options.lto
    };
    const outputFormat = options.outputFormat ?? "binary";
    const sourceContents = options.generateDebugInfo ? new SourceContents : undefined;
    const fileCallbacks = {
      resolveText: (bases, relPath) => {
        if (!callbacks?.resolveText)
          throw new Error(`No resolveText callback provided (reading ${relPath})`);
        return callbacks.resolveText(bases, relPath);
      },
      resolveBinary: (bases, relPath) => {
        if (!callbacks?.resolveBinary)
          throw new Error(`No resolveBinary callback provided (reading ${relPath})`);
        const found = callbacks.resolveBinary(bases, relPath);
        if (!found)
          return;
        return typeof found.content === "string" ? { baseIndex: found.baseIndex, content: base64.decode(found.content) } : found;
      },
      listDir: callbacks?.listDir,
      stat: callbacks?.stat
    };
    const asm = assemble(inputs, asmOpts, fileCallbacks, sourceContents, signal);
    collected = [...asm.messages];
    if (!asm.success) {
      return { success: false, outputs: [], messages: asm.messages };
    }
    if (outputFormat === "object") {
      const outputs = asm.modules.map((m) => ({
        name: `${m.name || "module"}.o`,
        data: serializeObjectFile(m, !!options.generateDebugInfo),
        type: "object"
      }));
      return { success: true, outputs, messages: asm.messages };
    }
    const lr = link(asm.modules, linkerOpts, outputFormat, sourceContents, asm.messages, signal);
    const outputName = defaultOutputName(outputFormat);
    const outputs = [{ name: outputName, data: lr.data, type: "binary" }];
    for (const extra of lr.extraOutputs) {
      outputs.push({ name: extra.name, data: extra.data, type: "binary" });
    }
    if (lr.mlb) {
      outputs.push({ name: "out.mlb", data: new TextEncoder().encode(lr.mlb), type: "mlb" });
    }
    if (lr.dbg) {
      outputs.push({ name: "out.dbg", data: new TextEncoder().encode(lr.dbg), type: "debug" });
    }
    if (lr.mapFile) {
      outputs.push({ name: "out.map", data: new TextEncoder().encode(lr.mapFile), type: "map" });
    }
    return {
      success: lr.success,
      outputs,
      messages: lr.messages
    };
  } catch (err) {
    return failureFromException(err, collected);
  }
}
function compileRequest(requestJson, callbacks, baseRom, signal) {
  try {
    const { inputs, options } = deserializeRequest(requestJson);
    return compile2(inputs, options, callbacks, baseRom, signal);
  } catch (err) {
    return failureFromException(err);
  }
}
function compileBrowser(requestJson, resolveText, resolveBinaryBase64, baseRom, shouldCancel) {
  const base64 = new Base64;
  const unpack = (json, decode) => {
    if (!json)
      return;
    const hit = JSON.parse(json);
    return { baseIndex: hit.baseIndex, content: decode(hit.content) };
  };
  const callbacks = {
    resolveText: (bases, relPath) => unpack(resolveText(JSON.stringify(bases), relPath), (s) => s),
    resolveBinary: (bases, relPath) => unpack(resolveBinaryBase64(JSON.stringify(bases), relPath), (s) => base64.decode(s))
  };
  const rom = baseRom && baseRom.length > 0 ? baseRom instanceof Uint8Array ? baseRom : new Uint8Array(Array.from(baseRom)) : undefined;
  const signal = shouldCancel ? { get aborted() {
    return shouldCancel();
  } } : undefined;
  const result = compileRequest(requestJson, callbacks, rom, signal);
  const resultJson = JSON.stringify({
    success: result.success,
    outputs: result.outputs.map((o) => ({ name: o.name, data: base64.encode(o.data), type: o.type })),
    messages: result.messages
  });
  return base64.encode(new TextEncoder().encode(resultJson));
}

// src/driver/entry-pako.ts
setGzipCodec(pakoCodec);
setJsEngine(functionEngine);
export {
  AsmEngine,
  AsmModule,
  Assembler,
  Base64,
  Cpu,
  JsActionTable,
  SourceContents,
  assemble,
  compile2 as compile,
  compileBrowser,
  compileRequest,
  deserializeObjectFile,
  deserializeRequest,
  findOutput,
  hiByte,
  hiBytes,
  isGzip,
  link,
  loByte,
  loBytes,
  searchFiles,
  serializeObjectFile,
  sym
};
