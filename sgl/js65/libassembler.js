// src/base64.ts
function eq(x, y) {
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
  const c = lt(x, 26) & x + "A".charCodeAt(0) | ge(x, 26) & lt(x, 52) & x + ("a".charCodeAt(0) - 26) | ge(x, 52) & lt(x, 62) & x + ("0".charCodeAt(0) - 52) | eq(x, 62) & "+".charCodeAt(0) | eq(x, 63) & "/".charCodeAt(0);
  return String.fromCharCode(c);
}
function charToByteOriginal(c) {
  const x = ge(c, "A".charCodeAt(0)) & le(c, "Z".charCodeAt(0)) & c - "A".charCodeAt(0) | ge(c, "a".charCodeAt(0)) & le(c, "z".charCodeAt(0)) & c - ("a".charCodeAt(0) - 26) | ge(c, "0".charCodeAt(0)) & le(c, "9".charCodeAt(0)) & c - ("0".charCodeAt(0) - 52) | eq(c, "+".charCodeAt(0)) & 62 | eq(c, "/".charCodeAt(0)) & 63;
  return x | eq(x, 0) & (eq(c, "A".charCodeAt(0)) ^ 65535);
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
class AbstractCpu {
  table;
  reverse;
  constructor(table) {
    this.table = table;
    const reverse = [];
    for (const [mnemonic, ops] of Object.entries(table)) {
      for (const [mode, op] of Object.entries(ops)) {
        reverse[op] = [mnemonic, mode];
      }
    }
    this.reverse = reverse;
  }
  op(mnemonic) {
    const ops = this.table[mnemonic];
    if (!ops)
      throw new Error(`Bad mnemonic: ${mnemonic}`);
    return ops;
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
        arg = `\$${(arg & 255).toString(16).padStart(2, "0")}`;
      } else {
        arg = `\$${(arg & 65535).toString(16).padStart(4, "0")}`;
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
function toHexViewString(data) {
  const bytes = [...data];
  const lines = [];
  for (let i = 0;i < bytes.length; i += 16) {
    lines.push([
      i.toString(16).padStart(8, "0") + ":",
      ...bytes.slice(i, i + 16).map((x) => x.toString(16).padStart(2, "0"))
    ].join(" "));
  }
  return lines.join("\n");
}
function spliceHead(a0, i, a1) {
  const l0 = a0.length;
  if (a1.length < l0 || !Array.isArray(a1)) {
    a0.splice(i, l0 - i, ...a1);
    return a0;
  }
  a1.unshift(...arrayHead(a0, i));
  return a1;
}
function spliceTail(a0, i, a1) {
  const l1 = a1.length;
  if (a0.length < l1 || !Array.isArray(a0)) {
    a1.splice(0, i, ...a0);
    return a1;
  }
  a0.push(...arrayTail(a1, i));
  return a0;
}
function arrayHead(arr, i) {
  const l = arr.length;
  if (i << 1 < l) {
    return arr.slice(0, i);
  }
  arr.splice(i, l - i);
  return arr;
}
function arrayTail(arr, i) {
  const l = arr.length;
  if (i << 1 < l) {
    arr.splice(0, i);
    return arr;
  }
  return arr.slice(i);
}
function assertNever(x) {
  throw new Error(`non-exhaustive check: ${x}`);
}

class SparseArray {
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
      for (let i = 0;i < chunk.length; i++) {
        target[start + i] = chunk[i];
      }
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
  set(start, ...values) {
    this.setInternal(start, values);
  }
  setInternal(start, values) {
    if (!values.length)
      return;
    const end = start + values.length;
    this._length = Math.max(this._length, end);
    let i0 = this._find(start);
    let i1 = this._find(end);
    if (i0 >= 0 && i0 === i1) {
      const [s0, a0] = this._chunks[i0];
      for (let i = 0;i < values.length; i++) {
        a0[start + i - s0] = values[i];
      }
      return;
    }
    const e0 = this._chunks[~i0 - 1];
    if (e0 && e0[0] + e0[1].length === start)
      i0 = ~i0 - 1;
    if (this._chunks[~i1]?.[0] === end)
      i1 = ~i1;
    if (i0 >= 0) {
      const [s0, a0] = this._chunks[i0];
      if (i1 !== i0 || !Array.isArray(values)) {
        values = spliceHead(a0, start - s0, values);
      } else {
        values.unshift(...a0.slice(0, start - s0));
      }
      start = s0;
    }
    if (i1 >= 0) {
      const [s1, a1] = this._chunks[i1];
      values = spliceTail(values, end - s1, a1);
    }
    const s = i0 < 0 ? ~i0 : i0;
    let e = i1 < 0 ? ~i1 : i1;
    if (i1 >= 0)
      e++;
    if (!Array.isArray(values))
      values = Array.from(values);
    this._chunks.splice(s, e - s, [start, values]);
  }
  splice(start, length = 1) {
    const end = start + length;
    let i0 = this._find(start);
    let i1 = this._find(end);
    let e0 = i0 >= 0 ? this._chunks[i0] : undefined;
    let e1 = i1 >= 0 ? this._chunks[i1] : undefined;
    if (e0) {
      const l0 = start - e0[0];
      if (l0) {
        e0 = [e0[0], e0 === e1 ? e0[1].slice(0, l0) : arrayHead(e0[1], l0)];
      } else {
        e0 = undefined;
        i0 = ~i0;
      }
    }
    if (e1) {
      e1 = [end, arrayTail(e1[1], end - e1[0])];
      if (!e1[1].length) {
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
    this._chunks.splice(s, e - s, ...entries);
  }
  slice(start, end) {
    if (end <= start)
      return [];
    const i = this._find(start);
    if (i < 0)
      throw new Error(`Absent: ${start}`);
    const [s, a] = this._chunks[i];
    if (s + a.length < end)
      throw new Error(`Absent: ${s + a.length}`);
    return a.slice(start - s, end - s);
  }
}

class SparseByteArray extends SparseArray {
  set(start, ...args) {
    this.setInternal(start, args[0] instanceof Uint8Array ? args[0] : Uint8Array.from(args));
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
      for (let i2 = 0;i2 < len - 1; ++i2) {
        const slen = suffixLength(i2);
        offsetTable[slen] = len - 1 - i2 + slen;
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
      out._chunks.push([start + offset, data]);
    }
    return out;
  }
  toIpsPatch() {
    let size = 8;
    for (const [, chunk] of this._chunks) {
      size += 5 + chunk.length;
    }
    const buffer = new Uint8Array(size);
    let i = 5;
    buffer[0] = 80;
    buffer[1] = 65;
    buffer[2] = 84;
    buffer[3] = 67;
    buffer[4] = 72;
    for (const [start, chunk] of this._chunks) {
      if (chunk.length > 65535)
        throw new Error(`Oops!`);
      buffer[i++] = start >>> 16;
      buffer[i++] = start >>> 8 & 255;
      buffer[i++] = start & 255;
      buffer[i++] = chunk.length >>> 8;
      buffer[i++] = chunk.length & 255;
      buffer.subarray(i, i + chunk.length).set(chunk);
      i += chunk.length;
    }
    buffer[i] = 69;
    buffer[i + 1] = 79;
    buffer[i + 2] = 70;
    return buffer;
  }
  toIpsHexString() {
    return toHexViewString(this.toIpsPatch());
  }
}

class BitSet {
  data = new Uint8Array(16);
  add(i) {
    const byte = i >>> 3;
    if (byte >= this.data.length) {
      let newSize = this.data.length;
      while (newSize <= byte)
        newSize <<= 1;
      const newData = new Uint8Array(newSize);
      newData.subarray(0, this.data.length).set(this.data);
      this.data = newData;
    }
    this.data[byte] |= 1 << (i & 7);
  }
  delete(i) {
    const byte = i >>> 3;
    if (byte < this.data.length)
      this.data[byte] &= ~(1 << (i & 7));
  }
  has(i) {
    return Boolean((this.data[i >>> 3] || 0) & 1 << (i & 7));
  }
}

class IntervalSet {
  data = [];
  [Symbol.iterator]() {
    return this.data[Symbol.iterator]();
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
    this.data.splice(s, e - s, entry);
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
    this.data.splice(s, e - s, ...entries);
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

// src/token.ts
function eq2(left, right) {
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
      return `NUM[\$${arg.num.toString(16)}]`;
    case "str":
      return `STR[\$${arg.str}]`;
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
      return `${(arg.rawStr ?? arg.str).toUpperCase()}`;
    default:
      assertNever(arg);
  }
}
function at(arg) {
  const s = arg.source;
  if (!s)
    return "";
  const parent = s.parent ? at({ source: s.parent }) : "";
  return `\n  at ${s.file}:${s.line}:${s.column}${parent}`;
}
function nameAt(arg) {
  if (!arg)
    return "at unknown";
  const token = arg;
  return (token.token ? name(token) : "") + at(arg);
}
function expectEol(token, name2 = "end of line") {
  if (token)
    throw new Error(`Expected ${name2}: ${nameAt(token)}`);
}
function expect(want, token, prev) {
  if (!token) {
    if (!prev)
      throw new Error(`Expected ${name(want)}`);
    throw new Error(`Expected ${name(want)} after ${nameAt(token)}`);
  }
  if (!eq2(want, token)) {
    throw new Error(`Expected ${name(want)}: ${nameAt(token)}`);
  }
}
function expectIdentifier(token, prev) {
  return expectStringToken("ident", "identifier", token, prev);
}
function optionalIdentifier(token) {
  return optionalStringToken("ident", "identifier", token);
}
function expectString(token, prev) {
  return expectStringToken("str", "constant string", token, prev);
}
function optionalString(token) {
  return optionalStringToken("str", "constant string", token);
}
function expectStringToken(want, name2, token, prev) {
  if (!token) {
    if (!prev)
      throw new Error(`Expected ${name2}`);
    throw new Error(`Expected ${name2} after ${nameAt(prev)}`);
  }
  if (token.token !== want) {
    throw new Error(`Expected ${name2}: ${nameAt(token)}`);
  }
  return token.str;
}
function optionalStringToken(want, name2, token) {
  if (!token) {
    return;
  }
  if (token.token !== want) {
    throw new Error(`Expected ${name2}: ${nameAt(token)}`);
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
        throw new Error(`Expected identifier: ${nameAt(ident)}`);
      const last = list[list.length - 1];
      throw new Error(`Expected identifier after ${nameAt(last)}`);
    } else if (i + 1 < list.length && !eq2(list[i + 1], COMMA)) {
      const sep = list[i + 1];
      throw new Error(`Expected comma: ${nameAt(sep)}`);
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
    if (!parens && eq2(token, COMMA)) {
      args.push(arg = []);
    } else {
      arg.push(token);
      if (eq2(token, LP))
        parens++;
      if (eq2(token, RP)) {
        if (--parens < 0)
          throw new Error(`Unbalanced paren${at(token)}`);
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
  if (!eq2(tokens[start], COLON)) {
    throw new Error(`Unexpected: ${nameAt(tokens[start])}`);
  }
  for (let i = start + 1;i < tokens.length; i++) {
    const tok = tokens[i];
    if (eq2(tok, COLON)) {
      if (key == null)
        throw new Error(`Missing key${at(tok)}`);
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
    if (eq2(tokens[i], want))
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
function str(t) {
  switch (t.token) {
    case "cs":
    case "ident":
    case "str":
    case "op":
      return t.str;
  }
  throw new Error(`Non-string token: ${nameAt(t)}`);
}
var LB = { token: "lb" };
var LC = { token: "lc" };
var LP = { token: "lp" };
var RC = { token: "rc" };
var RP = { token: "rp" };
var EOL = { token: "eol" };
var EOF = { token: "eof" };
var DEFINE = { token: "cs", str: ".define" };
var DOT_EOL = { token: "cs", str: ".eol" };
var ELSE = { token: "cs", str: ".else" };
var ELSEIF = { token: "cs", str: ".elseif" };
var ENDIF = { token: "cs", str: ".endif" };
var ENDMACRO = { token: "cs", str: ".endmacro" };
var ENDREPEAT = { token: "cs", str: ".endrepeat" };
var LOCAL = { token: "cs", str: ".local" };
var MACRO = { token: "cs", str: ".macro" };
var REPEAT = { token: "cs", str: ".repeat" };
var SET = { token: "cs", str: ".set" };
var BYTESTR = { token: "cs", str: ".bytestr" };
var COLON = { token: "op", str: ":" };
var COMMA = { token: "op", str: "," };
var STAR = { token: "op", str: "*" };
var IMMEDIATE = { token: "op", str: "#" };
var ASSIGN = { token: "op", str: "=" };
var CS_TOKEN_ALIAS_MAP = new Map([
  [".addr", ".word"],
  [".bank", ".bankbyte"],
  [".byt", ".byte"],
  [".def", ".defined"],
  [".endmac", ".endmacro"],
  [".endrep", ".endrepeat"],
  [".exitmac", ".exitmacro"],
  [".mac", ".macro"],
  [".undef", ".undefine"]
]);
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
function traverse(expr, f) {
  function rec(e) {
    if (!e.args)
      return e;
    return { ...e, args: e.args.map((c) => t(c, e)) };
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
  return traverse(expr, (expr2, rec) => f(rec(expr2)));
}
function evaluate(expr) {
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
      return sameChunk(expr, Math.max);
    case ".min":
      return sameChunk(expr, Math.min);
    default:
  }
  if (expr.args?.length === 1) {
    switch (mapped) {
      case "+":
        return expr.args[0];
      case "-":
        return unary(expr, (x) => -x);
      case "~":
        return unary(expr, (x) => ~x);
      case "!":
        return unary(expr, (x) => +!x);
      case "<":
        return unary(expr, (x) => x & 255);
      case ">":
        return unary(expr, (x) => x >> 8 & 255);
      case "^":
        return num(expr.args[0].meta?.bank) ?? expr;
      default:
        throw new Error(`Unknown unary operator: ${mapped}`);
    }
  }
  switch (mapped) {
    case "str":
      return expr;
    case ".match":
      return func(expr, (a, b) => a.num && b.num || a.str && b.str || a.sym && b.sym ? 1 : 0);
    case ".xmatch":
      return func(expr, (a, b) => a.num !== undefined && b.num !== undefined && a.num === b.num || a.str !== undefined && b.str !== undefined && a.str === b.str || a.sym !== undefined && b.sym !== undefined && a.sym === b.sym ? 1 : 0);
    case "+":
      return plus(expr);
    case "-":
      return minus(expr);
    case "*":
      return binary(expr, (a, b) => a * b);
    case "/":
      return binary(expr, (a, b) => Math.floor(a / b));
    case ".mod":
      return binary(expr, (a, b) => a % b);
    case "&":
      return binary(expr, (a, b) => a & b);
    case "|":
      return binary(expr, (a, b) => a | b);
    case "^":
      return binary(expr, (a, b) => a ^ b);
    case "<<":
      return binary(expr, (a, b) => a << b);
    case ">>":
      return binary(expr, (a, b) => a >>> b);
    case "<":
      return binary(expr, (a, b) => +(a < b));
    case "<=":
      return binary(expr, (a, b) => +(a <= b));
    case ">":
      return binary(expr, (a, b) => +(a > b));
    case ">=":
      return binary(expr, (a, b) => +(a >= b));
    case "=":
      return binary(expr, (a, b) => +(a == b));
    case "<>":
      return binary(expr, (a, b) => +(a != b));
    case "&&":
      return binary(expr, (a, b) => a && b);
    case "||":
      return binary(expr, (a, b) => a || b);
    case ".xor":
      return binary(expr, (a, b) => !a && b || !b && a || 0);
    default:
      throw new Error(`Unknown operator: ${mapped} Expr: ${JSON.stringify(expr)}`);
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
  throw new Error(`Expected identifier but got op: ${expr.op}`);
}
function parseOnly(tokens, index = 0, symbols2) {
  const [expr, i] = parse(tokens, index, symbols2);
  if (i < tokens.length) {
    parse(tokens, index, symbols2);
    throw new Error(`Garbage after expression: ${nameAt(tokens[i])}`);
  } else if (!expr) {
    throw new Error(`No expression?`);
  }
  return expr;
}
function parse(tokens, index = 0, symbols2) {
  const ops = [];
  const exprs = [];
  function popOp() {
    const [op, [, , arity]] = ops.pop();
    const args = exprs.splice(exprs.length - arity, arity);
    if (args.length !== arity)
      throw new Error(`shunting parse failed? ${nameAt(tokens[i])}`);
    exprs.push(fixSize({ op, args }));
  }
  let val = true;
  let i = index;
  for (;i < tokens.length; i++) {
    const front = tokens[i];
    if (val) {
      if (front.token === "cs" || front.token === "op") {
        const mapped = NAME_MAP.get(front.str);
        const prefix = PREFIXOPS.get(mapped ?? front.str);
        if (prefix) {
          ops.push([front.str, prefix]);
        } else if (front.token === "cs") {
          const op = front.str;
          if (!FUNCTIONS.has(op)) {
            throw new Error(`No such function: ${nameAt(front)}`);
          }
          const next = tokens[i + 1];
          if (next?.token !== "lp") {
            throw new Error(`Bad funcall: ${nameAt(next ?? front)}`);
          }
          const close = findBalanced(tokens, i + 1);
          if (close < 0) {
            throw new Error(`Never closed: ${nameAt(next)}`);
          }
          const args = [];
          for (const arg of parseArgList(tokens, i + 2, close)) {
            args.push(parseOnly(arg, 0, symbols2));
          }
          i = close;
          exprs.push(fixSize({ op, args }));
          val = false;
        } else if (eq2(front, STAR)) {
          exprs.push({ op: "sym", sym: "*" });
          val = false;
        } else {
          throw new Error(`Unknown prefix operator: ${nameAt(front)}`);
        }
      } else if (front.token === "lp") {
        const close = findBalanced(tokens, i);
        if (close < 0) {
          throw new Error(`No close paren: ${nameAt(front)}`);
        }
        const e = parseOnly(tokens.slice(i + 1, close), 0, symbols2);
        exprs.push(e);
        i = close;
        val = false;
      } else if (front.token === "ident") {
        const expr = symbols2?.get(front.str)?.expr;
        exprs.push(expr ? expr : { op: "sym", sym: front.str });
        val = false;
      } else if (front.token === "num") {
        const num = front.num;
        exprs.push({ op: "num", num, meta: size(num, front) });
        val = false;
      } else if (front.token === "str") {
        const s = front.str;
        exprs.push({ op: "str", str: s, meta: { size: s.length } });
        val = false;
      } else {
        throw new Error(`Bad expression token: ${nameAt(front)}`);
      }
    } else {
      if (eq2(front, COMMA)) {
        break;
      }
      if (front.token === "cs" || front.token === "op") {
        const mapped = NAME_MAP.get(front.str);
        const op = BINOPS.get(mapped ?? front.str);
        if (!op)
          break;
        while (ops.length) {
          const top = ops[ops.length - 1];
          const cmp = compareOp(top[1], op);
          if (cmp < 0)
            break;
          if (cmp === 0) {
            throw new Error(`Mixing ${top[0]} and ${front.str} needs explicit parens.${at(front)}`);
          }
          popOp();
        }
        ops.push([front.str, op]);
        val = true;
      } else {
        break;
      }
    }
  }
  while (ops.length)
    popOp();
  if (!tokens[index])
    throw new Error(`No token at ${index}:\n${tokens.map((t) => "  " + nameAt(t) + "\n")}`);
  if (exprs.length !== 1)
    throw new Error(`expression parse failed: nonunique result ${nameAt(tokens[index])}`);
  if (!exprs[0].source && tokens[index].source)
    exprs[0].source = tokens[index].source;
  return [exprs[0], i];
}
function sameChunk(_expr, _f) {
  throw new Error;
}
function num(num2) {
  if (num2 == null)
    return;
  return { op: "num", num: num2, meta: size(num2) };
}
function unary(expr, f) {
  const arg = expr.args[0];
  if (!isAbs(arg))
    return expr;
  const num2 = f(arg.num);
  return { op: "num", num: num2, meta: size(num2) };
}
function binary(expr, f) {
  const [a, b] = expr.args;
  if (!isAbs(a) || !isAbs(b))
    return expr;
  const num2 = f(a.num, b.num);
  return { op: "num", num: num2, meta: size(num2) };
}
function func(expr, f) {
  const [a, b] = expr.args;
  const num2 = f(a, b);
  return { op: "num", num: num2, meta: size(num2) };
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
    (out.meta || (out.meta = {})).size = size(out.num).size;
  }
  return out;
}
function minus(expr) {
  const [a, b] = expr.args;
  if (a.op !== "num" || b.op !== "num")
    return expr;
  const out = { op: "num", num: a.num - b.num };
  const isBranch = expr.meta?.branch;
  if (b.meta?.rel) {
    if (a.meta?.rel && a.meta.chunk === b.meta.chunk) {
      out.meta = { size: size(out.num).size };
      if (isBranch)
        out.meta.branch = true;
      return out;
    }
    return expr;
  }
  if (a.meta?.rel)
    out.meta = a.meta;
  if (!out.meta?.rel && out.meta?.size == null) {
    (out.meta || (out.meta = {})).size = size(out.num).size;
  }
  if (isBranch && out.op === "num") {
    (out.meta || (out.meta = {})).branch = true;
  }
  return out;
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
function fixSize(expr) {
  const xform = SIZE_TRANSFORMS.get(expr.op);
  const size = xform?.(...expr.args.map((e) => Number(e.meta?.size)));
  if (size)
    (expr.meta || (expr.meta = {})).size = size;
  return expr;
}
function size(num2, token) {
  if (num2 < 256 && token && token.token === "num" && token.width != null) {
    return { size: token.width };
  }
  return { size: 0 <= num2 && num2 < 256 ? 1 : 2 };
}
var BINARY = 2;
var UNARY = 1;
var BINOPS = new Map([
  ["*", [5, 4, BINARY]],
  ["/", [5, 4, BINARY]],
  [".mod", [5, 3, BINARY]],
  ["&", [5, 2, BINARY]],
  ["^", [5, 1, BINARY]],
  ["<<", [5, 0, BINARY]],
  [">>", [5, 0, BINARY]],
  ["+", [4, 2, BINARY]],
  ["-", [4, 2, BINARY]],
  ["|", [4, 1, BINARY]],
  ["<", [3, 0, BINARY]],
  ["<=", [3, 0, BINARY]],
  [">", [3, 0, BINARY]],
  [">=", [3, 0, BINARY]],
  ["=", [3, 0, BINARY]],
  ["<>", [3, 0, BINARY]],
  ["&&", [2, 3, BINARY]],
  [".xor", [2, 2, BINARY]],
  ["||", [2, 1, BINARY]]
]);
var PREFIXOPS = new Map([
  ["+", [9, -1, UNARY]],
  ["-", [9, -1, UNARY]],
  ["~", [9, -1, UNARY]],
  ["<", [9, -1, UNARY]],
  [">", [9, -1, UNARY]],
  ["^", [9, -1, UNARY]],
  ["!", [2, -1, UNARY]]
]);
var FUNCTIONS = new Set([
  ".byteat",
  ".wordat",
  ".match",
  ".xmatch",
  ".max",
  ".min"
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
  [".min", Math.max]
]);

// src/module.ts
var Segment;
((Segment) => {
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

// src/buffer.ts
function sticky(re) {
  const key = re.flags + " " + re.source;
  let s = stickySearchCache.get(key);
  if (!s) {
    const flags = re.flags.replace(/[gy]/g, "") + "y";
    const source = re.source.replace(/^\^/, "");
    s = new RegExp(source, flags);
    stickySearchCache.set(key, s);
  }
  return s;
}

class State {
  line;
  column;
  pos;
  match;
  constructor(line, column, pos, match) {
    this.line = line;
    this.column = column;
    this.pos = pos;
    this.match = match;
  }
}
var stickySearchCache = new Map;

class Buffer {
  content;
  line;
  column;
  pos = 0;
  lastMatch;
  constructor(content, line = 1, column = 0) {
    this.content = content;
    this.line = line;
    this.column = column;
  }
  advance(s) {
    this.pos += s.length;
    s = s.replace("\n", s.includes("\r") ? "" : "\r");
    const lines = s.split(/\r/g);
    if (lines.length > 1) {
      this.line += lines.length - 1;
      this.column = 0;
    }
    this.column += lines[lines.length - 1].length;
  }
  execAt(re) {
    const s = sticky(re);
    s.lastIndex = this.pos;
    return s.exec(this.content);
  }
  saveState() {
    return new State(this.line, this.column, this.pos, this.lastMatch);
  }
  restoreState(state) {
    this.line = state.line;
    this.column = state.column;
    this.pos = state.pos;
    this.lastMatch = state.match;
  }
  skip(re) {
    const match = this.execAt(re);
    if (!match)
      return false;
    this.advance(match[0]);
    return true;
  }
  space() {
    return this.skip(/^[ \t]+/);
  }
  newline() {
    return this.skip(/^(\r\n|\n|\r)/);
  }
  lookingAt(re) {
    if (typeof re === "string")
      return this.content.startsWith(re, this.pos);
    const s = sticky(re);
    s.lastIndex = this.pos;
    return s.test(this.content);
  }
  token(re) {
    let match;
    if (typeof re === "string") {
      if (!this.content.startsWith(re, this.pos))
        return false;
      match = [re];
    } else {
      match = this.execAt(re);
    }
    if (!match)
      return false;
    match.line = this.line;
    match.column = this.column;
    this.lastMatch = match;
    this.advance(match[0]);
    return true;
  }
  lookBehind(re) {
    const prefix = this.content.substring(0, this.pos);
    if (typeof re === "string")
      return prefix.endsWith(re);
    const match = re.exec(prefix);
    if (!match)
      return false;
    match.line = this.line;
    match.column = this.line;
    this.lastMatch = match;
    return true;
  }
  match() {
    return this.lastMatch;
  }
  group(index = 0) {
    return this.lastMatch?.[index];
  }
  eof() {
    return this.pos >= this.content.length;
  }
}

// src/tokenizer.ts
function parseHex(str2) {
  if (!/^[0-9a-f]+$/i.test(str2))
    throw new Error(`Bad hex number: \$${str2}`);
  return { token: "num", num: Number.parseInt(str2, 16), width: Math.ceil(str2.length / 2) };
}
function parseDec(str2) {
  if (!/^[0-9]+$/.test(str2))
    throw new Error(`Bad decimal number: ${str2}`);
  return { token: "num", num: Number.parseInt(str2, 10) };
}
function parseOct(str2) {
  if (!/^[0-7]+$/.test(str2))
    throw new Error(`Bad octal number: ${str2}`);
  return { token: "num", num: Number.parseInt(str2, 8) };
}
function parseBin(str2) {
  if (!/^[01]+$/.test(str2))
    throw new Error(`Bad binary number: %${str2}`);
  return { token: "num", num: Number.parseInt(str2, 2), width: Math.ceil(str2.length / 8) };
}

class Tokenizer {
  file;
  opts;
  sourceContents;
  errorCollector;
  buffer;
  constructor(str2, file = "input.s", opts = {}, sourceContents, errorCollector) {
    this.file = file;
    this.opts = opts;
    this.sourceContents = sourceContents;
    this.errorCollector = errorCollector;
    this.buffer = new Buffer(str2);
    this.sourceContents?.data?.set(file, str2);
  }
  async next() {
    return await new Promise((resolve) => {
      let tok = this.token();
      while (eq2(tok, EOL)) {
        tok = this.token();
      }
      const stack = [[]];
      let depth = 0;
      while (!eq2(tok, EOL) && !eq2(tok, EOF)) {
        if (eq2(tok, LC)) {
          stack[depth++].push(tok);
          stack.push([]);
        } else if (eq2(tok, RC)) {
          if (!depth) {
            this.errorCollector?.add("error", `Missing open curly`, tok.source);
          } else {
            const inner = stack.pop();
            const source = stack[--depth].pop().source;
            const token = { token: "grp", inner };
            if (source)
              token.source = source;
            stack[depth].push(token);
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
        const source = open.source;
        const token = { token: "grp", inner };
        if (source)
          token.source = source;
        stack[--depth].push(token);
      }
      resolve(stack[0].length ? stack[0] : undefined);
    });
  }
  token() {
    while (this.buffer.space() || this.buffer.token(/^;.*/) || this.opts.lineContinuations && this.buffer.token(/^\\(\r\n|\n|\r)/)) {
    }
    if (this.buffer.eof())
      return EOF;
    const source = {
      file: this.file,
      line: this.buffer.line,
      column: this.buffer.column
    };
    try {
      const tok = this.tokenInternal();
      if (this.opts.generateDebugInfo) {
        tok.source = source;
      }
      return tok;
    } catch (err) {
      const { file, line, column } = source;
      let last = this.buffer.group();
      last = last ? ` near '${last}'` : "";
      err.message += `\n  at ${file}:${line}:${column}${last}`;
      throw err;
    }
  }
  tokenInternal() {
    if (this.buffer.newline())
      return { token: "eol" };
    if (this.buffer.token(/^@+[a-z0-9_]*/i) || this.buffer.token(/^((::)?[a-z_][a-z0-9_]*)+/i)) {
      return this.strTok("ident");
    }
    if (this.buffer.token(/^\.[a-z][a-z0-9]*/i))
      return this.csTok();
    if (this.buffer.token(/^:([+-]\d+|[-+]+|<+rts|>*rts)/))
      return this.strTok("ident");
    if (this.buffer.token(/^(:|\++|-+|&&?|\|\|?|[#*/,=~!^]|<[<>=]?|>[>=]?)/)) {
      return this.strTok("op");
    }
    if (this.buffer.token("["))
      return { token: "lb" };
    if (this.buffer.token("{"))
      return { token: "lc" };
    if (this.buffer.token("("))
      return { token: "lp" };
    if (this.buffer.token("]"))
      return { token: "rb" };
    if (this.buffer.token("}"))
      return { token: "rc" };
    if (this.buffer.token(")"))
      return { token: "rp" };
    if (this.buffer.token(/^["']/))
      return this.tokenizeStr();
    if (this.buffer.token(/^[$%]?[0-9a-z_]+/i))
      return this.tokenizeNum();
    throw new Error(`Syntax error`);
  }
  tokenizeStr() {
    const b = this.buffer;
    const m = b.match();
    const end = m[0];
    let str2 = "";
    while (!b.lookingAt(end)) {
      if (b.eof())
        throw new Error(`EOF while looking for ${end}`);
      if (b.token(/^\\u([0-9a-f]{4})/i)) {
        str2 += String.fromCodePoint(parseInt(b.group(1), 16));
      } else if (b.token(/^\\x([0-9a-f]{2})/i)) {
        str2 += String.fromCharCode(parseInt(b.group(1), 16));
      } else if (b.token(/^\\(.)/)) {
        str2 += b.group(1);
      } else {
        b.token(/^./);
        str2 += b.group(0);
      }
    }
    b.token(end);
    return { token: "str", str: str2 };
  }
  strTok(token) {
    return { token, str: this.buffer.group() };
  }
  csTok() {
    let grp = this.buffer.group();
    return {
      token: "cs",
      str: CS_TOKEN_ALIAS_MAP.get(grp.toLowerCase()) ?? grp.toLowerCase(),
      rawStr: grp
    };
  }
  tokenizeNum(str2 = this.buffer.group()) {
    if (this.opts.numberSeparators)
      str2 = str2.replace(/_/g, "");
    if (str2[0] === "$")
      return parseHex(str2.substring(1));
    if (str2[0] === "%")
      return parseBin(str2.substring(1));
    if (str2[0] === "0")
      return parseOct(str2);
    return parseDec(str2);
  }
}

// src/assembler.ts
function writeString(data, str2) {
  for (let i = 0;i < str2.length; i++) {
    data.push(str2.charCodeAt(i));
  }
}
function parseSymbol(name2) {
  if (name2 === "*")
    return { type: "pc" };
  if (/^:\++$/.test(name2))
    return { type: "anon", num: name2.length - 1 };
  if (/^:\+\d+$/.test(name2))
    return { type: "anon", num: parseInt(name2.substring(2)) };
  if (/^:-+$/.test(name2))
    return { type: "anon", num: 1 - name2.length };
  if (/^:-\d+$/.test(name2))
    return { type: "anon", num: -parseInt(name2.substring(2)) };
  if (/^:>*rts$/.test(name2))
    return { type: "rts", num: Math.max(name2.length - 4, 1) };
  if (/^:<+rts$/.test(name2))
    return { type: "rts", num: 4 - name2.length };
  if (/^\++$/.test(name2))
    return { type: "rel", num: name2.length };
  if (/^-+$/.test(name2))
    return { type: "rel", num: -name2.length };
  return { type: "none" };
}
class BaseScope {
  symbols = new Map;
  pickScope(name2) {
    return [name2, this];
  }
  resolve(name2, opts = {}) {
    const { allowForwardRef = false, ref } = opts;
    const [tail, scope] = this.pickScope(name2);
    const sym = scope.symbols.get(tail);
    if (sym) {
      if (tail !== name2)
        sym.scoped = true;
      return sym;
    }
    if (!allowForwardRef)
      return;
    const symbol = { ref };
    scope.symbols.set(tail, symbol);
    if (tail !== name2)
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
  constructor(parent, kind) {
    super();
    this.parent = parent;
    this.kind = kind;
    this.global = parent ? parent.global : this;
  }
  pickScope(name2) {
    let scope = this;
    const split = name2.split(/::/g);
    const tail = split.pop();
    for (let i = 0;i < split.length; i++) {
      if (!i && !split[i]) {
        scope = scope.global;
        continue;
      }
      let child = scope.children.get(split[i]);
      while (!i && scope.parent && !child) {
        child = (scope = scope.parent).children.get(split[i]);
      }
      if (!child) {
        const scopeName = split.slice(0, i + 1).join("::");
        throw new Error(`Could not resolve scope ${scopeName}`);
      }
      scope = child;
    }
    return [tail, scope];
  }
}

class CheapScope extends BaseScope {
  clear() {
    this.validate();
    this.symbols.clear();
  }
  validate() {
    for (const [name2, sym] of this.symbols) {
      if (!sym.expr) {
        const at2 = sym.ref ? at(sym.ref) : "";
        throw new Error(`Cheap local label never defined: ${name2}${at2}`);
      }
    }
  }
}

class RecoverableError extends Error {
  constructor(message) {
    super(message);
    this.name = "RecoverableError";
  }
}

class ErrorCollector {
  messages = [];
  add(level, message, source) {
    this.messages.push({
      level,
      message,
      source,
      stack: new Error().stack
    });
  }
  addFromException(err, source, level = "error") {
    this.messages.push({
      level,
      message: err.message,
      source,
      stack: err.stack
    });
  }
  getMessages() {
    return this.messages;
  }
  hasErrors() {
    return this.messages.some((m) => m.level === "error");
  }
  clear() {
    this.messages = [];
  }
}

class Assembler {
  cpu;
  opts;
  segments = [];
  segmentData = new Map;
  segmentStack = [];
  symbols = [];
  globals = new Map;
  currentScope = new Scope;
  cheapLocals = new CheapScope;
  anonymousForward = [];
  anonymousReverse = [];
  relativeForward = [];
  relativeReverse = [];
  rtsRefsForward = [];
  rtsRefsReverse = [];
  chunks = [];
  written = new IntervalSet;
  _chunk = undefined;
  _name = undefined;
  _org = undefined;
  _segmentPrefix = "";
  _source;
  debugLabels = [];
  errorToken;
  errorCollector = new ErrorCollector;
  _exprMap = undefined;
  _segmentOffset = 0;
  constructor(cpu = Cpu.P02, opts = {}) {
    this.cpu = cpu;
    this.opts = opts;
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
      this.chunks.push(this._chunk);
      this._chunk.overwrite = this.overwriteMode;
      if (this.opts.generateDebugInfo) {
        this._chunk.sourceMap = new Map;
        this._chunk.labelIndex = new Map;
      }
    }
  }
  definedSymbol(sym) {
    if (this.globals.get(sym) === "import")
      return true;
    let scope = this.currentScope;
    const unscoped = !sym.includes("::");
    do {
      const s = scope.resolve(sym, { allowForwardRef: false });
      if (s)
        return Boolean(s.expr);
    } while (unscoped && (scope = scope.parent));
    return false;
  }
  constantSymbol(sym) {
    const s = this.currentScope.resolve(sym, { allowForwardRef: false });
    return Boolean(s && s.expr && !(s.id < 0));
  }
  referencedSymbol(sym) {
    const s = this.currentScope.resolve(sym, { allowForwardRef: false });
    return s != null;
  }
  evaluate(expr) {
    expr = this.resolve(expr);
    if (expr.op === "num" && !expr.meta?.rel)
      return expr.num;
    return;
  }
  pc() {
    const num2 = this.chunk.data.length;
    const meta = { rel: true, chunk: this.chunks.length - 1 };
    if (this._chunk?.org != null)
      meta.org = this._chunk.org;
    return evaluate({ op: "num", num: num2, meta });
  }
  symbol(name2) {
    return evaluate(parseOnly([{ token: "ident", str: name2 }], 0, this.currentScope.symbols));
  }
  where() {
    if (!this._chunk)
      return "";
    if (this.chunk.org == null)
      return "";
    return `${this.chunk.segments.join(",")}:\$${(this.chunk.org + this.chunk.data.length).toString(16)}`;
  }
  resolve(expr) {
    const out = traverse(expr, (e, rec) => {
      while (e.op === "sym" && e.sym) {
        e = this.resolveSymbol(e);
      }
      return evaluate(rec(e));
    });
    if (this.opts.refExtractor?.ref && out !== expr) {
      const orig = this.exprMap.get(expr) || expr;
      this.exprMap.set(out, orig);
    }
    return out;
  }
  resolveSymbol(symbol) {
    const name2 = symbol.sym;
    const parsed = parseSymbol(name2);
    if (parsed.type === "pc") {
      return this.pc();
    } else if (parsed.type === "anon" && parsed.num > 0) {
      const i = parsed.num - 1;
      let num2 = this.anonymousForward[i];
      if (num2 != null)
        return { op: "sym", num: num2 };
      this.anonymousForward[i] = num2 = this.symbols.length;
      this.symbols.push({ id: num2 });
      return { op: "sym", num: num2 };
    } else if (parsed.type === "rts" && parsed.num > 0) {
      const i = parsed.num - 1;
      let num2 = this.rtsRefsForward[i];
      if (num2 != null)
        return { op: "sym", num: num2 };
      this.rtsRefsForward[i] = num2 = this.symbols.length;
      this.symbols.push({ id: num2 });
      return { op: "sym", num: num2 };
    } else if (parsed.type === "rel" && parsed.num > 0) {
      let num2 = this.relativeForward[parsed.num - 1];
      if (num2 != null)
        return { op: "sym", num: num2 };
      this.relativeForward[name2.length - 1] = num2 = this.symbols.length;
      this.symbols.push({ id: num2 });
      return { op: "sym", num: num2 };
    } else if (parsed.type === "anon" && parsed.num < 0) {
      const i = this.anonymousReverse.length + parsed.num;
      if (i < 0)
        this.fail(`Bad anonymous backref: ${name2}`);
      return this.anonymousReverse[i];
    } else if (parsed.type === "rts" && parsed.num < 0) {
      const i = this.rtsRefsReverse.length + parsed.num;
      if (i < 0)
        this.fail(`Bad rts backref: ${name2}`);
      return this.rtsRefsReverse[i];
    } else if (parsed.type === "rel" && parsed.num < 0) {
      const expr = this.relativeReverse[name2.length - 1];
      if (expr == null)
        this.fail(`Bad relative backref: ${name2}`);
      return expr;
    }
    const scope = name2.startsWith("@") ? this.cheapLocals : this.currentScope;
    const sym = scope.resolve(name2, { allowForwardRef: true, ref: symbol });
    if (sym.expr) {
      return sym.expr;
    }
    if (sym.id == null) {
      sym.id = this.symbols.length;
      this.symbols.push(sym);
    }
    return { op: "sym", num: sym.id };
  }
  chunkData(chunk) {
    return { org: this.chunks[chunk].org };
  }
  closeScopes() {
    this.cheapLocals.clear();
    const collector = this.errorCollector;
    const close = (scope) => {
      for (const child of scope.children.values()) {
        close(child);
      }
      for (const child of scope.anonymousChildren) {
        close(child);
      }
      for (const [name2, sym] of scope.symbols) {
        if (sym.expr || sym.id == null)
          continue;
        if (scope.parent) {
          if (sym.scoped) {
            collector.add("error", `Symbol '${name2}' undefined`, sym.ref?.source);
            continue;
          }
          const parentSym = scope.parent.symbols.get(name2);
          if (!parentSym) {
            scope.parent.symbols.set(name2, sym);
          } else if (parentSym.id != null && parentSym.id >= 0) {
            sym.expr = { op: "sym", num: parentSym.id };
          } else if (parentSym.expr) {
            sym.expr = parentSym.expr;
          } else {
            collector.add("error", `Internal error: symbol '${name2}' has neither id nor expr`, sym.ref?.source);
          }
        }
      }
    };
    if (this.currentScope.parent) {
      collector.add("error", `Scope never closed`);
    }
    close(this.currentScope);
    for (const [name2, global] of this.globals) {
      const sym = this.currentScope.symbols.get(name2);
      if (global === "export") {
        if (!sym?.expr) {
          collector.add("error", `Exported symbol '${name2}' undefined`, sym?.ref?.source);
          continue;
        }
        if (sym.id == null) {
          sym.id = this.symbols.length;
          this.symbols.push(sym);
        }
        sym.export = name2;
      } else if (global === "import") {
        if (!sym)
          continue;
        if (sym.expr) {
          collector.add("error", `Symbol '${name2}' already defined`, sym.ref?.source);
          continue;
        }
        sym.expr = { op: "im", sym: name2 };
      } else {
        assertNever(global);
      }
    }
    for (const [name2, sym] of this.currentScope.symbols) {
      if (!sym.expr) {
        collector.add("error", `Symbol '${name2}' undefined`, sym.ref?.source);
      }
    }
  }
  module() {
    this.closeScopes();
    const chunks = [];
    for (const chunk of this.chunks) {
      chunks.push({ ...chunk, data: Uint8Array.from(chunk.data) });
    }
    const symbols2 = [];
    for (const symbol of this.symbols) {
      if (symbol.expr == null) {
        continue;
      }
      const out = { expr: symbol.expr };
      if (symbol.export != null)
        out.export = symbol.export;
      symbols2.push(out);
    }
    const segments = [...this.segmentData.values()];
    let debugSymbols = undefined;
    if (this.opts.generateDebugInfo) {
      debugSymbols = [];
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
        for (const [name2, sym] of scope.symbols) {
          if (sym.expr != null) {
            const expr = { ...sym.expr };
            if (name2.startsWith("@")) {
              const baseName = name2.substring(1).replace(":", "");
              expr.sym = makeUniqueName(baseName);
            } else {
              if (!expr.sym) {
                expr.sym = name2;
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
      collectSymbols(this.currentScope.global);
      for (const { name: name2, expr: originalExpr } of this.debugLabels) {
        const expr = { ...originalExpr };
        const baseName = name2.substring(1).replace(":", "");
        expr.sym = makeUniqueName(baseName);
        debugSymbols.push({ expr });
      }
    }
    return { chunks, symbols: symbols2, segments, debugSymbols };
  }
  async line(tokens) {
    if (eq2(tokens[1], ASSIGN) || eq2(tokens[1], SET)) {
      return;
    }
    this._source = tokens[0].source;
    try {
      if (tokens.length < 3 && eq2(tokens[tokens.length - 1], COLON)) {
        this.label(tokens[0]);
      } else if (tokens[0].token === "cs") {
        this.directive(tokens);
      } else {
        await this.instruction(tokens);
      }
    } catch (err) {
      if (err instanceof RecoverableError) {
        return;
      }
      throw err;
    }
  }
  async tokens(source, signal) {
    let line;
    while (line = await source.next()) {
      if (signal?.aborted)
        throw new Error("Compilation cancelled");
      await this.line(line);
    }
  }
  directive(tokens) {
    this.errorToken = tokens[0];
    try {
      switch (str(tokens[0])) {
        case ".org":
          return this.org(this.parseConst(tokens, 1));
        case ".reloc":
          return this.parseNoArgs(tokens, 1), this.reloc();
        case ".assert":
          return this.assert(...this.parseAssert(tokens));
        case ".segment":
          return this.segment(...this.parseSegmentList(tokens, 1, false));
        case ".byte":
          return this.byte(...this.parseDataList(tokens, true));
        case ".bytestr":
          return this.byteInternal(this.parseByteStr(tokens));
        case ".res":
          return this.res(...this.parseResArgs(tokens));
        case ".word":
          return this.word(...this.parseDataList(tokens));
        case ".free":
          return this.free(this.parseConst(tokens, 1));
        case ".segmentprefix":
          return this.segmentPrefix(this.parseStr(tokens, 1));
        case ".import":
          return this.import(...this.parseIdentifierList(tokens));
        case ".export":
          return this.export(...this.parseIdentifierList(tokens));
        case ".scope":
          return this.scope(this.parseOptionalIdentifier(tokens));
        case ".endscope":
          return this.parseNoArgs(tokens, 1), this.endScope();
        case ".proc":
          return this.proc(this.parseRequiredIdentifier(tokens));
        case ".endproc":
          return this.parseNoArgs(tokens, 1), this.endProc();
        case ".pushseg":
          return this.pushSeg(...this.parseSegmentList(tokens, 1, true));
        case ".popseg":
          return this.parseNoArgs(tokens, 1), this.popSeg();
        case ".move":
          return this.move(...this.parseMoveArgs(tokens));
        case ".out":
          return this.log("info", tokens);
        case ".warning":
          return this.log("warn", tokens);
        case ".error":
          return this.log("error", tokens);
        case ".a8":
        case ".i8":
        case ".p02":
          return;
      }
      this.fail(`Unknown directive: ${nameAt(tokens[0])}`);
    } finally {
      this.errorToken = undefined;
    }
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
    if (ident === ":") {
      this.anonymousReverse.push(expr);
      const sym = this.anonymousForward.shift();
      if (sym != null)
        this.symbols[sym].expr = expr;
      if (this.opts.generateDebugInfo) {
        this.debugLabels.push({ name: "@p", expr });
      }
      return;
    } else if (/^\++$/.test(ident)) {
      const sym = this.relativeForward[ident.length - 1];
      delete this.relativeForward[ident.length - 1];
      if (sym != null)
        this.symbols[sym].expr = expr;
      if (this.opts.generateDebugInfo) {
        this.debugLabels.push({ name: "@p", expr });
      }
      return;
    } else if (/^-+$/.test(ident)) {
      this.relativeReverse[ident.length - 1] = expr;
      if (this.opts.generateDebugInfo) {
        this.debugLabels.push({ name: "@m", expr });
      }
      return;
    }
    if (!ident.startsWith("@")) {
      this.cheapLocals.clear();
      if (!this.chunk.name && !this.chunk.data.length)
        this.chunk.name = ident;
      if (this.opts.refExtractor?.label && this.chunk.org != null) {
        this.opts.refExtractor.label(ident, this.chunk.org + this.chunk.data.length, this.chunk.segments);
      }
      if (this.opts.generateDebugInfo && this._chunk?.labelIndex) {
        this._chunk.labelIndex.set(ident, this.chunk.data.length);
      }
    }
    this.assignSymbol(ident, false, expr, token);
  }
  assignSym(tokens) {
    if (this.opts.generateDebugInfo && tokens[0].source) {
      this._source = tokens[0].source;
    }
    this.assign(str(tokens[0]), this.parseExpr(tokens, 2));
  }
  setSym(tokens) {
    if (this.opts.generateDebugInfo && tokens[0].source) {
      this._source = tokens[0].source;
    }
    this.set(str(tokens[0]), this.parseExpr(tokens, 2));
  }
  assign(ident, expr) {
    if (ident.startsWith("@")) {
      this.fail(`Cheap locals may only be labels: ${ident}`);
    }
    if (typeof expr !== "number")
      expr = this.resolve(expr);
    this.assignSymbol(ident, false, expr);
    if (this.opts.refExtractor?.assign && typeof expr === "number") {
      this.opts.refExtractor.assign(ident, expr);
    }
  }
  set(ident, expr) {
    if (ident.startsWith("@")) {
      this.fail(`Cheap locals may only be labels: ${ident}`);
    }
    if (typeof expr !== "number")
      expr = this.resolve(expr);
    this.assignSymbol(ident, true, expr);
  }
  assignSymbol(ident, mut, expr, token) {
    if (typeof expr === "number")
      expr = { op: "num", num: expr, meta: size(expr) };
    if (this.opts.generateDebugInfo && this._source && !expr.source) {
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
      scope.symbols.set(ident, sym = { id: -1 });
    } else if (!mut && sym.expr) {
      const orig = sym.expr.source ? `\nOriginally defined${at(sym.expr)}` : "";
      this.fail(`Redefining symbol ${ident}${orig}`, token);
    }
    sym.expr = expr;
    if (isCheapLocal && !mut && this.opts.generateDebugInfo) {
      this.debugLabels.push({ name: ident, expr });
    }
  }
  async instruction(...args) {
    let mnemonic;
    let arg;
    if (args.length === 1 && Array.isArray(args[0])) {
      const tokens = args[0];
      mnemonic = expectIdentifier(tokens[0]).toLowerCase();
      arg = this.parseArg(tokens, 1);
    } else if (typeof args[1] === "string") {
      mnemonic = args[0];
      const tokenizer = new Tokenizer(args[1]);
      arg = this.parseArg(await tokenizer.next(), 0);
    } else {
      [mnemonic, arg] = args;
      if (!arg)
        arg = ["imp"];
      mnemonic = mnemonic.toLowerCase();
    }
    if (mnemonic === "rts") {
      const expr = this.pc();
      this.rtsRefsReverse.push(expr);
      const sym = this.rtsRefsForward.shift();
      if (sym != null)
        this.symbols[sym].expr = expr;
    }
    const ops = this.cpu.op(mnemonic);
    const m = arg[0];
    if (m === "add" || m === "a,x" || m === "a,y") {
      let expr = arg[1];
      const s = expr.meta?.size || 2;
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
    } else if (eq2(front, IMMEDIATE)) {
      return ["imm", this.parseExpr(tokens, start + 1)];
    }
    if (eq2(front, COLON) && tokens.length === start + 2 && next.token === "op" && /^[-+]+$/.test(next.str)) {
      return ["add", { op: "sym", sym: ":" + next.str }];
    } else if (tokens.length === start + 1 && front.token === "op" && /^[-+]+$/.test(front.str)) {
      return ["add", { op: "sym", sym: front.str }];
    }
    if (front.token == "ident" && (front.str == "a" || front.str == "z") && eq2(next, COLON)) {
      const [mode, out] = this.parseArg(tokens, start + 2);
      if (mode == "acc" || mode == "imm") {
        this.fail(`Cannot force direct or absolute addressing on acc or imm arguments`, front);
      }
      const lookup = front.str == "z" ? ForceDirectAddressingMap : ForceAbsoluteAddressingMap;
      const adr = lookup.get(mode);
      return [adr ? adr : mode, out];
    }
    if (eq2(front, LP) || this.opts.allowBrackets && eq2(front, LB)) {
      const close = findBalanced(tokens, start);
      if (close < 0)
        this.fail(`Unbalanced ${name(front)}`, front);
      const args2 = parseArgList(tokens, start + 1, close);
      if (!args2.length)
        this.fail(`Bad argument`, front);
      const expr2 = this.parseExpr(args2[0], 0);
      if (args2.length === 1) {
        if (eq2(tokens[close + 1], COMMA) && isRegister(tokens[close + 2], "y")) {
          expectEol(tokens[close + 3]);
          return ["iny", expr2];
        }
        expectEol(tokens[close + 1]);
        return ["ind", expr2];
      } else if (args2.length === 2 && args2[1].length === 1) {
        if (isRegister(args2[1][0], "x"))
          return ["inx", expr2];
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
    const num2 = this.chunk.data.length + arglen + 1;
    const meta = { rel: true, chunk: this.chunks.length - 1 };
    if (this._chunk?.org)
      meta.org = this._chunk.org;
    const nextPc = { op: "num", num: num2, meta };
    const rel = { op: "-", args: [expr, nextPc], meta: { branch: true } };
    if (expr.source)
      rel.source = expr.source;
    this.opcode(op, arglen, rel);
  }
  opcode(op, arglen, expr) {
    if (arglen)
      expr = this.resolve(expr);
    const { chunk } = this;
    this.markWritten(1 + arglen);
    if (this.opts.generateDebugInfo && this._chunk?.sourceMap && this._source) {
      this._chunk.sourceMap.set(chunk.data.length, this._source);
    }
    chunk.data.push(op);
    if (arglen) {
      this.append(expr, arglen);
    }
    if (!chunk.name)
      chunk.name = `Code`;
  }
  markWritten(size2) {
    if (this._chunk?.org == null)
      return;
    const offset = this.orgToOffset(this._chunk.org);
    if (offset != null) {
      this.written.add(offset + this._chunk.data.length, offset + this._chunk.data.length + size2);
    }
  }
  append(expr, size2) {
    const { chunk } = this;
    if (this.opts.refExtractor?.ref && chunk.org != null) {
      const orig = this._exprMap?.get(expr) || expr;
      if (symbols(orig).length > 0) {
        this.opts.refExtractor.ref(orig, size2, chunk.org + chunk.data.length, chunk.segments);
      }
    }
    expr = this.resolve(expr);
    const val = expr.num;
    if (expr.op !== "num" || expr.meta?.rel) {
      const offset = chunk.data.length;
      (chunk.subs || (chunk.subs = [])).push({ offset, size: size2, expr });
      this.writeNumber(chunk.data, size2);
    } else {
      this.writeNumber(chunk.data, size2, val);
    }
  }
  org(addr, name2) {
    if (this._org != null && this._chunk != null && this._org + this._chunk.data.length === addr) {
      return;
    }
    this._org = addr;
    this._chunk = undefined;
    this._name = name2;
  }
  reloc(name2) {
    this._org = undefined;
    this._chunk = undefined;
    this._name = name2;
  }
  segment(...segments) {
    this.segments = segments.map((s) => typeof s === "string" ? s : s.name);
    for (const s of segments) {
      if (typeof s === "object") {
        const data = this.segmentData.get(s.name) || { name: s.name };
        this.segmentData.set(s.name, Segment.merge(data, s));
      }
    }
    this._chunk = undefined;
    this._name = undefined;
  }
  assert(expr, _level, message) {
    expr = this.resolve(expr);
    const val = this.evaluate(expr);
    if (val != null) {
      if (!val) {
        let pc = "";
        const chunk = this.chunk;
        if (chunk.org != null) {
          pc = ` (PC=\$${(chunk.org + chunk.data.length).toString(16)})`;
        }
        this.fail(`${message}\nAssertion failed${pc}`, expr);
      }
    } else {
      const { chunk } = this;
      (chunk.asserts || (chunk.asserts = [])).push(expr);
    }
  }
  byte(...args) {
    this.byteInternal(args);
  }
  byteInternal(args) {
    const { chunk } = this;
    this.markWritten(args.length);
    for (const arg of args) {
      if (typeof arg === "number") {
        if (this.opts.generateDebugInfo && this._chunk?.sourceMap && this._source) {
          this._chunk.sourceMap.set(chunk.data.length, this._source);
        }
        this.writeNumber(chunk.data, 1, arg);
      } else if (typeof arg === "string") {
        if (this.opts.generateDebugInfo && this._chunk?.sourceMap && this._source) {
          for (let i = 0;i < arg.length; i++) {
            this._chunk.sourceMap.set(chunk.data.length + i, this._source);
          }
        }
        writeString(chunk.data, arg);
      } else {
        if (this.opts.generateDebugInfo && this._chunk?.sourceMap && this._source) {
          this._chunk.sourceMap.set(chunk.data.length, this._source);
        }
        this.append(arg, 1);
      }
    }
  }
  res(count2, value) {
    if (!count2)
      return;
    this.byte(...new Array(count2).fill(value ?? 0));
  }
  word(...args) {
    const { chunk } = this;
    this.markWritten(2 * args.length);
    for (const arg of args) {
      if (this.opts.generateDebugInfo && this._chunk?.sourceMap && this._source) {
        this._chunk.sourceMap.set(chunk.data.length, this._source);
        this._chunk.sourceMap.set(chunk.data.length + 1, this._source);
      }
      if (typeof arg === "number") {
        this.writeNumber(chunk.data, 2, arg);
      } else {
        this.append(arg, 2);
      }
    }
  }
  free(size2) {
    if (this._org == null)
      this.fail(`.free in .reloc mode`);
    this.markWritten(size2);
    const segments = this.segments.length > 1 ? this.segments.filter((s2) => {
      const data = this.segmentData.get(s2);
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
    } else if (size2 < 0) {
      this.fail(`.free with negative size: ${size2}`);
    }
    if (this._chunk) {
      this._org += this._chunk.data.length;
    }
    this._chunk = undefined;
    const name2 = segments[0];
    let s = this.segmentData.get(name2);
    if (!s)
      this.segmentData.set(name2, s = { name: name2 });
    (s.free || (s.free = [])).push([this._org, this._org + size2]);
    this._org += size2;
  }
  segmentPrefix(prefix) {
    this._segmentPrefix = prefix;
  }
  import(...idents) {
    for (const ident of idents) {
      this.globals.set(ident, "import");
    }
  }
  export(...idents) {
    for (const ident of idents) {
      this.globals.set(ident, "export");
    }
  }
  scope(name2) {
    this.enterScope(name2, "scope");
  }
  proc(name2) {
    this.label(name2);
    this.enterScope(name2, "proc");
  }
  enterScope(name2, kind) {
    const existing = name2 ? this.currentScope.children.get(name2) : undefined;
    if (existing) {
      if (this.opts.reentrantScopes) {
        this.currentScope = existing;
        return;
      }
      this.fail(`Cannot re-enter scope ${name2}`);
    }
    const child = new Scope(this.currentScope, kind);
    if (name2) {
      this.currentScope.children.set(name2, child);
    } else {
      this.currentScope.anonymousChildren.push(child);
    }
    this.currentScope = child;
  }
  endScope() {
    this.exitScope("scope");
  }
  endProc() {
    this.exitScope("proc");
  }
  exitScope(kind) {
    if (this.currentScope.kind !== kind || !this.currentScope.parent) {
      this.fail(`.end${kind} without .${kind}`);
    }
    this.currentScope = this.currentScope.parent;
  }
  pushSeg(...segments) {
    this.segmentStack.push([this.segments, this._chunk]);
    if (segments) {
      this.segment(...segments);
    }
  }
  popSeg() {
    if (!this.segmentStack.length)
      this.fail(`.popseg without .pushseg`);
    [this.segments, this._chunk] = this.segmentStack.pop();
    this._org = this._chunk?.org;
  }
  move(size2, source) {
    this.append({ op: ".move", args: [source], meta: { size: size2 } }, size2);
  }
  log(level, line) {
    const str2 = expectString(line[1], line[0]);
    expectEol(line[2], "a single string");
    const source = line[0].source;
    const errorLevel = level === "warn" ? "warning" : level;
    this.errorCollector.add(errorLevel, str2, source);
    if (level === "error") {
      throw new RecoverableError(str2);
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
    return parseOnly(tokens, start, this.currentScope.symbols);
  }
  parseStr(tokens, start) {
    const str2 = expectString(tokens[start]);
    expectEol(tokens[start + 1], "a single string");
    return str2;
  }
  parseOptionalStr(tokens, start) {
    const tok = tokens[start];
    if (!tok)
      return;
    if (tok.token === "str")
      return tok.str;
    return;
  }
  parseSegmentList(tokens, start, allowEmptySegmentList) {
    if (tokens.length < start + 1) {
      if (allowEmptySegmentList) {
        return [];
      }
      this.fail(`Expected a segment list`, tokens[start - 1]);
    }
    return parseArgList(tokens, 1).map((ts) => {
      const str2 = this._segmentPrefix + expectString(ts[0]);
      if (ts.length === 1)
        return str2;
      if (!eq2(ts[1], COLON)) {
        this.fail(`Expected comma or colon: ${name(ts[1])}`, ts[1]);
      }
      const seg = { name: str2 };
      const attrs = parseAttrList(ts, 1);
      for (const [key, val] of attrs) {
        switch (key) {
          case "bank":
            seg.bank = this.parseConst(val, 0);
            break;
          case "size":
            seg.size = this.parseConst(val, 0);
            break;
          case "off":
            seg.offset = this.parseConst(val, 0);
            break;
          case "mem":
            seg.memory = this.parseConst(val, 0);
            break;
          case "fill":
            seg.fill = this.parseConst(val, 0);
            break;
          case "out":
            seg.out = this.parseOptionalStr(val, 0) ?? "%O";
            break;
          case "overlay":
            seg.overlay = this.parseStr(val, 0);
            break;
          case "zp":
            seg.addressing = 1;
            break;
          default:
            this.fail(`Unknown segment attr: ${key}`);
        }
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
  parseResArgs(tokens) {
    const data = this.parseDataList(tokens);
    if (data.length > 2)
      this.fail(`Expected at most 2 args`, data[2]);
    if (!data.length)
      this.fail(`Expected at least 1 arg`);
    const count2 = this.evaluate(data[0]);
    if (count2 == null)
      this.fail(`Expected constant count`);
    const val = data[1] && this.evaluate(data[1]);
    if (data[1] && val == null)
      this.fail(`Expected constant value`);
    return [count2, val];
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
  parseMoveArgs(tokens) {
    const args = parseArgList(tokens, 1);
    if (args.length !== 2) {
      this.fail(`Expected constant number, then identifier`);
    }
    const num2 = this.evaluate(this.parseExpr(args[0], 0));
    if (num2 == null)
      this.fail(`Expected a constant number`);
    const offset = this.resolve(this.parseExpr(args[1], 0));
    if (offset.op === "num" && offset.meta?.chunk != null) {
      return [num2, offset];
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
    const level = optionalIdentifier(args.at(1)?.at(0)) ?? "error";
    const message = optionalString(args.at(2)?.at(0)) ?? "Assertion failed";
    return [expr, level, message];
  }
  getMessages() {
    return this.errorCollector.getMessages();
  }
  hasErrors() {
    return this.errorCollector.hasErrors();
  }
  fail(msg, at2) {
    if (!at2 && this.errorToken)
      at2 = this.errorToken;
    const source = at2?.source ?? this._source;
    this.errorCollector.add("error", msg, source);
    let fullMsg = msg;
    if (source) {
      fullMsg += at({ source });
    } else if (!this._source && this._chunk?.name) {
      fullMsg += `\n  in ${this._chunk.name}`;
    }
    throw new RecoverableError(fullMsg);
  }
  writeNumber(data, size2, val) {
    for (let i = 0;i < size2; i++) {
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

// src/preamble.ts
var Sim = {
  segments: [{
    name: "code",
    default: true,
    offset: 0,
    size: 64768,
    memory: 512,
    free: [[512, 64768]]
  }]
};
var NesNrom = {
  segments: [{
    name: "header",
    size: 16,
    offset: 0,
    memory: 0
  }, {
    name: "code",
    default: true,
    size: 32768,
    offset: 16,
    memory: 32768,
    free: [[32768, 65536]]
  }, {
    name: "chr",
    size: 8192,
    offset: 32784,
    memory: 0
  }]
};
var Targets = new Map([
  ["sim", Sim],
  ["nes-nrom", NesNrom]
]);

// src/sprintf.ts
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

// src/define.ts
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
    } else if (eq2(tok, DOT_EOL)) {
      overflow.push(line = []);
      continue;
    }
    const source = tok.source && tokens[0].source ? { ...tok.source, parent: tokens[0].source } : tok.source || tokens[0].source;
    line.push(source ? { ...tok, source } : tok);
  }
  overflow = overflow.filter((l) => l.length);
  if (overflow.length && end < tokens.length) {
    return "cannot expand .eol without consuming to end of line";
  }
  tokens.splice(start, end - start, ...splice);
  return overflow;
}
var DEBUG = false;

class Define {
  overloads;
  constructor(overloads) {
    this.overloads = overloads;
  }
  canOverload() {
    return this.overloads[this.overloads.length - 1].canOverload();
  }
  append(define) {
    if (!this.canOverload()) {
      const prevDef = this.overloads[this.overloads.length - 1].definition;
      const at2 = prevDef ? at(prevDef) : "";
      const prev = at2.replace(/at/, "previously defined at");
      const nextDef = define.overloads[0].definition;
      const next = nextDef ? nameAt(nextDef) : "";
      throw new Error(`Non-overloadable: ${next}${prev}`);
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
      console.error(reasons.join("\n"));
    return;
  }
  static from(macro) {
    if (!eq2(macro[0], DEFINE))
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
        throw new Error(`Expected close paren ${nameAt(macro[2])}`);
      }
      overload = new CStyleDefine(identsFromCList(macro.slice(3, paramEnd)), macro.slice(paramEnd + 1), macro[1]);
    } else {
      overload = new TexStyleDefine([], macro.slice(2), macro[1]);
    }
    return new Define([overload]);
  }
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
    if (start < tokens.length && eq2(LP, tokens[i])) {
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
          const end = eq2(delim, DOT_EOL) ? tokens.length : find(tokens, delim, i);
          if (end < 0)
            return `could not find delimiter ${name(delim)}`;
          replacements.set(pat.str, tokens.slice(i, end));
          i = end;
        }
      } else if (eq2(pat, DOT_EOL)) {
        if (i < tokens.length)
          return `could not match .eol`;
      } else {
        if (!eq2(tokens[i++], pat)) {
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

// src/macro.ts
class Macro {
  params;
  production;
  constructor(params, production) {
    this.params = params;
    this.production = production;
  }
  static async from(line, source) {
    if (!eq2(line[0], MACRO))
      throw new Error(`invalid`);
    if (line[1]?.token !== "ident")
      throw new Error(`invalid`);
    const params = identsFromCList(line.slice(2));
    const lines = [];
    let next;
    while (next = await source.next()) {
      if (eq2(next[0], ENDMACRO))
        return new Macro(params, lines);
      lines.push(next);
    }
    throw new Error(`EOF looking for .endmacro: ${nameAt(line[1])}`);
  }
  expand(tokens, idGen) {
    let i = 1;
    const replacements = new Map;
    const lines = [];
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
      throw new Error(`Too many macro parameters: ${nameAt(tokens[i])}`);
    }
    const locals = new Map;
    for (const line of this.production) {
      if (eq2(line[0], LOCAL)) {
        const locallist = identsFromCList(line.slice(1));
        for (const local of locallist) {
          locals.set(local, `${local}@${idGen.next()}`);
        }
      }
      const map2 = (toks) => {
        const mapped = [];
        for (const tok of toks) {
          if (eq2(tok, LOCAL))
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
          } else if (tok.token === "grp") {
            mapped.push({ token: "grp", inner: map2(tok.inner) });
            continue;
          }
          const source = tok.source && tokens[0].source ? { ...tok.source, parent: tokens[0].source } : tok.source || tokens[0].source;
          mapped.push(source ? { ...tok, source } : tok);
        }
        return mapped;
      };
      lines.push(map2(line));
    }
    return lines.filter((m) => m.length != 0);
  }
}

// src/preprocessor.ts
function idGen(env) {
  let id = ID_MAP.get(env);
  if (!id)
    ID_MAP.set(env, id = ((num2) => ({ next: () => num2++ }))(0));
  return id;
}
function parseOneIdent(ts, prev) {
  const e = parseOneExpr(ts, prev);
  return identifier(e);
}
function parseOneExpr(ts, prev) {
  if (!ts.length) {
    if (!prev)
      throw new Error(`Expected expression`);
    throw new Error(`Expected expression: ${nameAt(prev)}`);
  }
  return parseOnly(ts);
}
function noGarbage(token) {
  if (token)
    throw new Error(`garbage at end of line: ${nameAt(token)}`);
}
function badClose(open, tok) {
  throw new Error(`${name(tok)} with no ${open}${at(tok)}`);
}
function fail(msg) {
  throw new Error(msg);
}
var MAX_STACK_DEPTH = 100;
var ID_MAP = new WeakMap;

class Preprocessor {
  stream;
  env;
  errorCollector;
  macros;
  outQueue = [];
  repeats = [];
  constructor(stream, env, parent, errorCollector) {
    this.stream = stream;
    this.env = env;
    this.errorCollector = errorCollector;
    this.macros = parent ? parent.macros : new Map;
    if (!errorCollector && parent?.errorCollector) {
      this.errorCollector = parent.errorCollector;
    }
  }
  async tokens() {
    const tokens = [];
    let tok;
    while (tok = await this.next()) {
      tokens.push(tok);
    }
    return tokens;
  }
  async next() {
    while (true) {
      if (this.outQueue.length)
        return this.outQueue.shift();
      try {
        const more = await this.pump();
        if (!more)
          return;
      } catch (err) {
        if (err instanceof RecoverableError) {
          continue;
        }
        throw err;
      }
    }
  }
  async pump() {
    const line = await this.readLine();
    if (line == null)
      return false;
    while (line.length) {
      const front = line[0];
      switch (front.token) {
        case "ident":
          if (eq2(line[1], COLON)) {
            this.outQueue.push(line.splice(0, 2));
            break;
          }
          if (eq2(line[1], ASSIGN)) {
            this.env.assignSym(line);
          } else if (eq2(line[1], SET)) {
            this.env.setSym(line);
          }
          if (!this.tryExpandMacro(line))
            this.outQueue.push(line);
          return true;
        case "cs":
          if (!await this.tryRunDirective(line))
            this.outQueue.push(line);
          return true;
        case "op":
          if (/^[-+]+$/.test(front.str)) {
            const label = [front];
            const second = line[1];
            if (second && eq2(second, COLON)) {
              label.push(second);
              line.splice(0, 2);
            } else {
              label.push({ token: "op", str: ":" });
              line.splice(0, 1);
            }
            this.outQueue.push(label);
            break;
          } else if (front.str === ":") {
            this.outQueue.push(line.splice(0, 1));
            break;
          }
        default:
          throw new Error(`Unexpected: ${nameAt(line[0])}`);
      }
    }
    return true;
  }
  async readLine() {
    const line = await this.stream.next();
    if (line == null)
      return line;
    return this.expandLine(line);
  }
  expandLine(line, pos = 0) {
    const front = line[0];
    let depth = 0;
    let maxPos = 0;
    while (pos < line.length) {
      if (pos > maxPos) {
        maxPos = pos;
        depth = 0;
      } else if (depth++ > MAX_STACK_DEPTH) {
        throw new Error(`Maximum expansion depth reached: ${line.map(name).join(" ")}${at(front)}`);
      }
      pos = this.expandToken(line, pos);
    }
    return line;
  }
  expandToken(line, pos) {
    const front = line[pos];
    if (front.token === "ident") {
      const define = this.macros.get(front.str);
      if (define instanceof Define) {
        const overflow = define.expand(line, pos);
        if (overflow) {
          if (overflow.length)
            this.stream.unshift(...overflow);
          return pos;
        }
      }
    } else if (front.token === "cs") {
      return this.expandDirective(front.str, line, pos);
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
    const expansion = macro.expand(line, idGen(this.env));
    this.stream.enter();
    this.stream.unshift(...expansion);
    return true;
  }
  expandDirective(directive, line, i) {
    switch (directive) {
      case ".define":
      case ".ifdef":
      case ".ifndef":
      case ".undefine":
        return this.skipIdentifier(line, i);
      case ".skip":
        return this.skip(line, i);
      case ".noexpand":
        return this.noexpand(line, i);
      case ".tcount":
        return this.parseArgs(line, i, 1, this.tcount);
      case ".ident":
        return this.parseArgs(line, i, 1, this.ident);
      case ".string":
        return this.parseArgs(line, i, 1, this.string);
      case ".concat":
        return this.parseArgs(line, i, 0, this.concat);
      case ".sprintf":
        return this.parseArgs(line, i, 0, this.sprintf);
      case ".cond":
        return this.parseArgs(line, i, 0, this.cond);
      case ".blank":
        return this.parseArgs(line, i, 1, this.blank);
      case ".defined":
        return this.parseArgs(line, i, 1, this.definedSymbol);
      case ".definedsymbol":
        return this.parseArgs(line, i, 1, this.definedSymbol);
      case ".constantsymbol":
        return this.parseArgs(line, i, 1, this.constantSymbol);
      case ".referencedsymbol":
        return this.parseArgs(line, i, 1, this.referencedSymbol);
    }
    return i + 1;
  }
  skip(line, i) {
    line.splice(i, 1);
    const skipped = line[i];
    if (skipped?.token === "grp") {
      this.expandToken(skipped.inner, 0);
    } else {
      this.expandToken(line, i + 1);
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
  parseArgs(line, i, argCount, fn) {
    const cs = line[i];
    expect(LP, line[i + 1], cs);
    const end = findBalanced(line, i + 1);
    const args = parseArgList(line, i + 2, end).map((ts) => {
      if (ts.length === 1 && ts[0].token === "grp")
        ts = ts[0].inner;
      return this.expandLine(ts);
    });
    if (argCount && args.length !== argCount) {
      throw new Error(`Expected ${argCount} parameters: ${nameAt(cs)}`);
    }
    const expansion = fn.call(this, cs, ...args);
    line.splice(i, end + 1 - i, ...expansion);
    return i;
  }
  tcount(cs, arg) {
    return [{ token: "num", num: count(arg), source: cs.source }];
  }
  ident(cs, arg) {
    const str2 = expectString(arg[0], cs);
    expectEol(arg[1], "a single token");
    return [{ token: "ident", str: str2, source: arg[0].source }];
  }
  string(cs, arg) {
    const str2 = expectIdentifier(arg[0], cs);
    expectEol(arg[1], "a single token");
    return [{ token: "str", str: str2, source: arg[0].source }];
  }
  concat(cs, ...args) {
    const strs = args.map((ts) => {
      const str2 = expectString(ts[0]);
      expectEol(ts[1], "a single string");
      return str2;
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
            arg = this.evaluateConst(parseOneExpr(argToks, prevTok));
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
  cond(_cs, ..._args) {
    throw new Error("unimplemented");
  }
  blank(cs, arg) {
    return [{ token: "num", num: arg.length === 0 ? 1 : 0 }];
  }
  definedSymbol(cs, arg) {
    const ident = expectIdentifier(arg[0], cs);
    expectEol(arg[1], "a single identifier");
    return [{ token: "num", num: this.env.definedSymbol(ident) ? 1 : 0 }];
  }
  constantSymbol(cs, arg) {
    const ident = expectIdentifier(arg[0], cs);
    expectEol(arg[1], "a single identifier");
    return [{ token: "num", num: this.env.constantSymbol(ident) ? 1 : 0 }];
  }
  referencedSymbol(cs, arg) {
    const ident = expectIdentifier(arg[0], cs);
    expectEol(arg[1], "a single identifier");
    return [{ token: "num", num: this.env.referencedSymbol(ident) ? 1 : 0 }];
  }
  skipIdentifier(line, i) {
    return line[i + 1]?.token === "ident" ? i + 2 : i + 1;
  }
  async tryRunDirective(line) {
    const first = line[0];
    if (first.token !== "cs")
      throw new Error(`impossible`);
    const handler = this.runDirectives[first.str];
    if (!handler)
      return false;
    await handler(line);
    return true;
  }
  evaluateConst(expr) {
    const evalWrapper = (ex) => {
      if (ex.op === "sym" && this.env.definedSymbol(ex.sym)) {
        const num2 = this.env.evaluate(ex);
        if (num2 === undefined)
          throw new Error(`Symbol ${ex.sym} is undefined`);
        return evaluate({ op: "num", num: num2, meta: size(num2, undefined) });
      }
      return evaluate(ex);
    };
    expr = traversePost(expr, evalWrapper);
    if (expr.op === "num" && !expr.meta?.rel)
      return expr.num;
    const at2 = at(expr);
    throw new Error(`Expected a constant: ${at2} : ${expr}`);
  }
  runDirectives = {
    ".define": (line) => this.parseDefine(line),
    ".undefine": (line) => this.parseUndefine(line),
    ".else": ([cs]) => badClose(".if", cs),
    ".elseif": ([cs]) => badClose(".if", cs),
    ".endif": ([cs]) => badClose(".if", cs),
    ".endmacro": ([cs]) => badClose(".macro", cs),
    ".endrepeat": (line) => this.parseEndRepeat(line),
    ".exitmacro": async ([, a]) => {
      noGarbage(a);
      this.stream.exit();
      return await Promise.resolve();
    },
    ".if": ([cs, ...args]) => this.parseIf(!!this.evaluateConst(parseOneExpr(args, cs))),
    ".ifdef": ([cs, ...args]) => this.parseIf(this.parseIfDef(args, cs)),
    ".ifndef": ([cs, ...args]) => this.parseIf(!this.parseIfDef(args, cs)),
    ".ifblank": ([, ...args]) => this.parseIf(!args.length),
    ".ifnblank": ([, ...args]) => this.parseIf(!!args.length),
    ".ifref": ([cs, ...args]) => this.parseIf(this.env.referencedSymbol(parseOneIdent(args, cs))),
    ".ifnref": ([cs, ...args]) => this.parseIf(!this.env.referencedSymbol(parseOneIdent(args, cs))),
    ".ifsym": ([cs, ...args]) => this.parseIf(this.env.definedSymbol(parseOneIdent(args, cs))),
    ".ifnsym": ([cs, ...args]) => this.parseIf(!this.env.definedSymbol(parseOneIdent(args, cs))),
    ".ifconst": ([cs, ...args]) => this.parseIf(this.env.constantSymbol(parseOneIdent(args, cs))),
    ".ifnconst": ([cs, ...args]) => this.parseIf(!this.env.constantSymbol(parseOneIdent(args, cs))),
    ".ifp02": ([CSS, ...args]) => this.parseIf(true),
    ".ifp4510": ([CSS, ...args]) => this.parseIf(false),
    ".ifp816": ([CSS, ...args]) => this.parseIf(false),
    ".ifpc02": ([CSS, ...args]) => this.parseIf(false),
    ".ifpdtv": ([CSS, ...args]) => this.parseIf(false),
    ".ifpsc02": ([CSS, ...args]) => this.parseIf(false),
    ".macro": (line) => this.parseMacro(line),
    ".repeat": (line) => this.parseRepeat(line)
  };
  async parseDefine(line) {
    const name2 = expectIdentifier(line[1], line[0]);
    const define = Define.from(line);
    const prev = this.macros.get(name2);
    if (prev instanceof Define) {
      prev.append(define);
    } else if (prev) {
      throw new Error(`Already defined: ${name2}`);
    } else {
      this.macros.set(name2, define);
    }
    return await Promise.resolve();
  }
  async parseUndefine(line) {
    const [cs, ident, eol] = line;
    const name2 = expectIdentifier(ident, cs);
    expectEol(eol);
    if (!this.macros.has(name2)) {
      throw new Error(`Not defined: ${nameAt(ident)}`);
    }
    this.macros.delete(name2);
    return await Promise.resolve();
  }
  async parseMacro(line) {
    const name2 = expectIdentifier(line[1], line[0]);
    const macro = await Macro.from(line, this.stream);
    const prev = this.macros.get(name2);
    if (prev)
      throw new Error(`Already defined: ${name2}`);
    this.macros.set(name2, macro);
  }
  async parseRepeat(line) {
    const [expr, end] = parse(line, 1);
    const at2 = line[1] || line[0];
    if (!expr)
      throw new Error(`Expected expression: ${nameAt(at2)}`);
    const times = this.evaluateConst(expr);
    if (times == null)
      throw new Error(`Expected a constant${at(expr)}`);
    let ident;
    if (end < line.length) {
      if (!eq2(line[end], COMMA)) {
        throw new Error(`Expected comma: ${nameAt(line[end])}`);
      }
      ident = expectIdentifier(line[end + 1]);
      expectEol(line[end + 2]);
    }
    const lines = [];
    let depth = 1;
    while (depth > 0) {
      line = await this.stream.next() ?? fail(`.repeat with no .endrep`);
      if (eq2(line[0], REPEAT))
        depth++;
      if (eq2(line[0], ENDREPEAT))
        depth--;
      lines.push(line);
    }
    this.repeats.push([lines, times, -1, ident]);
    this.parseEndRepeat(line);
  }
  async parseEndRepeat(line) {
    expectEol(line[1]);
    const top = this.repeats.pop();
    if (!top)
      throw new Error(`.endrep with no .repeat${at(line[0])}`);
    if (++top[2] >= top[1])
      return await Promise.resolve();
    this.repeats.push(top);
    this.stream.unshift(...top[0].map((line2) => line2.map((token) => {
      if (token.token !== "ident" || token.str !== top[3])
        return token;
      const t = { token: "num", num: top[2] };
      if (token.source)
        t.source = token.source;
      return t;
    })));
    return await Promise.resolve();
  }
  async parseIf(cond) {
    let depth = 1;
    let done = false;
    const result = [];
    while (depth > 0) {
      const line = await this.stream.next();
      if (!line)
        throw new Error(`EOF looking for .endif`);
      const front = line[0];
      if (eq2(front, ENDIF)) {
        depth--;
        if (!depth)
          break;
      } else if (front.token === "cs" && front.str.startsWith(".if")) {
        depth++;
      } else if (depth === 1 && !done) {
        if (cond && (eq2(front, ELSE) || eq2(front, ELSEIF))) {
          cond = false;
          done = true;
          continue;
        } else if (eq2(front, ELSEIF)) {
          cond = !!this.evaluateConst(parseOneExpr(this.expandLine(line.slice(1)), front));
          continue;
        } else if (eq2(front, ELSE)) {
          cond = true;
          continue;
        }
      }
      if (cond)
        result.push(line);
    }
    this.stream.unshift(...result);
  }
  parseIfDef(args, cs) {
    return this.macros.has(parseOneIdent(args, cs)) || this.env.definedSymbol(parseOneIdent(args, cs));
  }
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
  _nes2_mapper6 = (mi1 & \$0F) << 4
  _nes2_mapper7 = mi1 & \$F0
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
    tv2 = \$02
  .else
    tv2 = \$00
  .endif
  .if tv1 = 'n' .or tv1 = 'N'
    _nes2_tvsystem = \$00 | tv2
  .elseif tv1 = 'p' .or tv1 = 'P'
    _nes2_tvsystem = \$01 | tv2
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
    battery_bit = \$02
  .else
    battery_bit = \$00
  .endif

.pushseg
  .segment header_segment
  .byte "NES",\$1A
  .byte _nes2_prgsize, _nes2_chrsize
  .byte _nes2_mapper6 | _nes2_mirror | battery_bit
  .byte _nes2_mapper7 | \$08  ; not supporting vs/pc10 yet

  .byte _nes2_mapper8
  .byte (_nes2_chrsizehi << 4) | _nes2_prgsizehi
  .byte (_nes2_bramsize << 4) | _nes2_wramsize
  .byte (_nes2_chrbramsize << 4) | _nes2_chrramsize

  .byte _nes2_tvsystem, 0, 0, 0
.popseg
.endmacro

`;

// src/tokenstream.ts
var MAX_DEPTH = 100;
var MACPACK = new Map([
  ["common", text],
  ["generic", text2],
  ["longbranch", text3],
  ["nes2header", text4]
]);

class SourceContents {
  data = new Map;
}

class TokenStream {
  readFile;
  readFileBinary;
  opts;
  sourceContents;
  stack = [];
  constructor(readFile, readFileBinary, opts, sourceContents) {
    this.readFile = readFile;
    this.readFileBinary = readFileBinary;
    this.opts = opts;
    this.sourceContents = sourceContents;
  }
  loadFile(path, action) {
    const paths = this.opts?.includePaths ?? ["./"];
    for (const base of paths) {
      try {
        return action(base, path);
      } catch (_e) {
      }
    }
    throw new Error(`Could not find file ${path} in include directories: ${paths.join(",")}`);
  }
  async next() {
    while (this.stack.length) {
      const [tok, front] = this.stack[this.stack.length - 1];
      if (front.length)
        return front.pop();
      const line = await tok?.next();
      if (line) {
        if (line?.[0].token !== "cs")
          return line;
        switch (line[0].str) {
          case ".include": {
            const path = this.str(line);
            if (!this.readFile)
              this.err(line);
            const code = await this.loadFile(path, this.readFile);
            this.enter(new Tokenizer(code, path, this.opts, this.sourceContents));
            continue;
          }
          case ".macpack": {
            const pack = expectIdentifier(line[1])?.toLowerCase();
            const code = MACPACK.get(pack) ?? this.err(line);
            this.enter(new Tokenizer(code, `${pack}.macpack`, this.opts, this.sourceContents));
            continue;
          }
          case ".incbin": {
            if (!this.readFileBinary)
              this.err(line);
            if (line.length < 1) {
              this.err(line);
            }
            const path = expectString(line[1], line[0]);
            let offset = 0;
            let length = undefined;
            if (line.length > 2) {
              const args = parseArgList(line, 2);
              if (args[1]) {
                const expr = evaluate(parseOnly(args[1]));
                offset = expr.num ?? 0;
              }
              if (args[2]) {
                const expr = evaluate(parseOnly(args[2]));
                length = expr.num ?? -1;
              }
            }
            let inbytes = await this.loadFile(path, this.readFileBinary);
            inbytes = typeof inbytes === "string" ? new Base64().decode(inbytes) : inbytes;
            const end = length !== undefined ? offset + length : undefined;
            const bin = new Base64().encode(inbytes.slice(offset, end));
            const out = [
              BYTESTR,
              { token: "str", str: bin }
            ];
            return out;
          }
          default:
            return line;
        }
      }
      this.stack.pop();
    }
    return;
  }
  unshift(...lines) {
    if (!this.stack.length)
      throw new Error(`Cannot unshift after EOF`);
    const front = this.stack[this.stack.length - 1][1];
    for (let i = lines.length - 1;i >= 0; i--) {
      front.push(lines[i]);
    }
  }
  enter(tokens) {
    const frame = [undefined, []];
    if (tokens)
      frame[0] = tokens;
    this.stack.push(frame);
    if (this.stack.length > MAX_DEPTH)
      throw new Error(`Stack overflow`);
  }
  exit() {
    this.stack.pop();
  }
  err(line) {
    const msg = this.str(line);
    throw new Error(msg + at(line[0]));
  }
  str(line) {
    const str2 = expectString(line[1], line[0]);
    expectEol(line[2], "a single string");
    return str2;
  }
}

// src/linker.ts
function fail2(msg) {
  throw new Error(msg);
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

class Linker {
  opts;
  static assemble(contents) {
    const opts = { lineContinuations: true };
    const source = new Tokenizer(contents, "contents.s", opts);
    const asm = new Assembler(Cpu.P02);
    const toks = new TokenStream(undefined, undefined, opts);
    toks.enter(source);
    const pre = new Preprocessor(toks, asm);
    asm.tokens(pre);
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
  _link = new Link;
  _exports;
  constructor(opts = {}) {
    this.opts = opts;
  }
  read(file) {
    this._link.readFile(file);
    return this;
  }
  base(data, offset = 0) {
    this._link.base(data, offset);
    return this;
  }
  link(signal) {
    const target = Targets.get(this.opts.target?.toLowerCase());
    if (target) {
      target.segments.forEach((seg) => this._link.addRawSegment(seg));
    }
    return this._link.link(signal);
  }
  report(verbose = false) {
    console.log(this._link.report(verbose));
  }
  exports() {
    if (this._exports)
      return this._exports;
    return this._exports = this._link.buildExports();
  }
  watch(...offset) {
    this._link.watches.push(...offset);
  }
  static getComment(sourceLines, line = 0, debugLevel = 1, sourceInfo) {
    let comment = "";
    if (sourceLines && line >= 0) {
      const actualLine = line;
      let firstLine = actualLine;
      if (debugLevel === 0) {
        do {
          firstLine--;
        } while (firstLine >= 0 && /^\s*(;|.*:\s*$)/.test(sourceLines[firstLine]));
        const lines = sourceLines.slice(firstLine + 1, actualLine + 1);
        const result = [];
        for (const l of lines) {
          const trimmed = l.trim();
          if (/^\s*;/.test(l)) {
            const commentText = trimmed.substring(1).trim().replace(/:/g, "");
            if (commentText) {
              result.push(commentText);
            }
          } else if (/^\s*.*:\s*$/.test(l)) {
          } else {
            const inlineCommentMatch = l.match(/;(.*)$/);
            if (inlineCommentMatch) {
              const commentText = inlineCommentMatch[1].trim().replace(/:/g, "");
              if (commentText) {
                result.push(commentText);
              }
            }
          }
        }
        comment = result.join("\\n");
      } else {
        do {
          firstLine--;
        } while (firstLine >= 0 && /^\s*(;|.*:\s*$)/.test(sourceLines[firstLine]));
        comment = sourceLines.slice(firstLine + 1, actualLine + 1).filter((s) => !/^\s*\S+:\s*$/.test(s)).map((s) => s.trim().replace(/:/g, "")).join("\\n");
      }
    }
    if (debugLevel >= 2 && sourceInfo) {
      const suffix = ` in file ${sourceInfo.file}:${sourceInfo.line}`;
      comment = comment ? comment + suffix : suffix.trim();
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
  getDebugInfo(sources, debugLevel = 1) {
    if (!sources)
      return "";
    const sourceLinesCache = new Map;
    const getSourceLines = (file) => {
      if (sourceLinesCache.has(file))
        return sourceLinesCache.get(file);
      const lines = sources.data.get(file)?.split("\n");
      sourceLinesCache.set(file, lines);
      return lines;
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
    const isAnonTempLabel = (name2) => !realLabels.has(name2);
    const addLabel = (entry, isAnonTemp = false) => {
      const key = `${entry.type}:${entry.address}`;
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
    let prgBaseOffset = Infinity;
    for (const [_, seg] of this._link.segments) {
      if (seg.offset < prgBaseOffset && seg.memory >= 16384) {
        prgBaseOffset = seg.offset;
      }
    }
    if (prgBaseOffset === Infinity)
      prgBaseOffset = 16;
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
      if (chunk?.segment?.isRam || !chunk) {
        const result = Linker.getLabelTypeAndAddress(s.expr.num ?? 0);
        labelType = result.type;
        addr = result.address;
      } else {
        const offsetInChunk = s.expr.num - (meta?.rel ? 0 : chunk.org ?? 0);
        const fileOffset = (chunk.offset ?? 0) + offsetInChunk;
        addr = fileOffset - prgBaseOffset;
        labelType = "NesPrgRom";
      }
      let comment = "";
      if (s.expr.source) {
        const { file, line } = s.expr.source;
        const sourceLines = getSourceLines(file);
        comment = Linker.getComment(sourceLines, line, debugLevel, s.expr.source);
      }
      const isAnonTemp = isAnonTempLabel(s.expr.sym);
      addLabel({
        type: labelType,
        address: `${addr.toString(16)}`,
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
          const fileOffset = c.offset + offsetInChunk;
          addr = fileOffset - prgBaseOffset;
          labelType = "NesPrgRom";
        }
        let comment = "";
        const srcInfo = c.sourceMap?.get(offsetInChunk);
        if (srcInfo) {
          const { file, line } = srcInfo;
          const sourceLines = getSourceLines(file);
          comment = Linker.getComment(sourceLines, line - 1, debugLevel, srcInfo);
        }
        addLabel({
          type: labelType,
          address: addr.toString(16),
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
      let rangeStart = -1;
      let rangeEnd = -1;
      let rangeSrcInfo;
      let rangeName;
      let name2 = c.name;
      const flushRange = () => {
        if (rangeStart < 0 || !rangeSrcInfo)
          return;
        let { file, line } = rangeSrcInfo;
        line--;
        const sourceLines = getSourceLines(file);
        const comment = Linker.getComment(sourceLines, line, debugLevel, rangeSrcInfo);
        const n = !seenLabels.has(rangeName) ? rangeName : "";
        if (debugLevel === 0 && !comment && !n) {
          rangeStart = -1;
          return;
        }
        seenLabels.add(n);
        const formatAddr = (start, end) => {
          if (end > start + 1) {
            return `${start.toString(16)}-${(end - 1).toString(16)}`;
          }
          return start.toString(16);
        };
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
            address: formatAddr(addrStart, addrEnd),
            label: n,
            comment
          }, false);
        } else {
          const prgRomOffsetStart = c.offset + rangeStart - prgBaseOffset;
          const prgRomOffsetEnd = c.offset + rangeEnd - prgBaseOffset;
          addLabel({
            type: "NesPrgRom",
            address: formatAddr(prgRomOffsetStart, prgRomOffsetEnd),
            label: n,
            comment
          }, false);
        }
        rangeStart = -1;
      };
      for (let offset = 0;offset < c.size; offset++) {
        name2 = rev.get(offset) || name2;
        const srcInfo = c.sourceMap?.get(offset);
        const sameSource = srcInfo && rangeSrcInfo && srcInfo.file === rangeSrcInfo.file && srcInfo.line === rangeSrcInfo.line;
        if (srcInfo && sameSource && offset === rangeEnd) {
          rangeEnd = offset + 1;
        } else {
          flushRange();
          if (srcInfo) {
            rangeStart = offset;
            rangeEnd = offset + 1;
            rangeSrcInfo = srcInfo;
            rangeName = name2;
          }
        }
      }
      flushRange();
    }
    for (const label of labelMap.values()) {
      data += `${label.type}:${label.address}:${label.label}:${label.comment}\n`;
    }
    return data;
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
  isRam;
  constructor(segment) {
    const name2 = this.name = segment.name;
    this.bank = segment.bank ?? 0;
    this.addressing = segment.addressing ?? 2;
    this.size = segment.size ?? fail2(`Size must be specified: ${name2}`);
    this.isRam = !segment.out && segment.offset == null;
    this.offset = segment.offset ?? (this.isRam ? segment.memory ?? 0 : fail2(`Offset must be specified: ${name2}`));
    this.memory = segment.memory ?? 0;
    this.fill = segment.fill ?? 0;
  }
  static RAM_OFFSET = 2147483648;
  get delta() {
    return this.isRam ? LinkSegment.RAM_OFFSET : this.offset - this.memory;
  }
}

class LinkChunk {
  linker;
  index;
  name;
  size;
  segments;
  asserts;
  subs = new Set;
  selfSubs = new Set;
  deps = new Set;
  imports = new Set;
  follow = new Map;
  overlaps = false;
  labelIndex;
  sourceMap;
  _data;
  _org;
  _offset;
  _segment;
  _overwrite;
  constructor(linker, index, chunk, chunkOffset, symbolOffset) {
    this.linker = linker;
    this.index = index;
    this.name = chunk.name;
    this.size = chunk.data.length;
    this.segments = chunk.segments;
    this.labelIndex = chunk.labelIndex && new Map(chunk.labelIndex);
    this.sourceMap = chunk.sourceMap && new Map(chunk.sourceMap);
    this._data = chunk.data;
    for (const sub of chunk.subs || []) {
      this.subs.add(translateSub(sub, chunkOffset, symbolOffset));
    }
    this.asserts = (chunk.asserts || []).map((e) => translateExpr(e, chunkOffset, symbolOffset));
    if (chunk.org != null)
      this._org = chunk.org;
    this._overwrite = chunk.overwrite || "allow";
  }
  get org() {
    return this._org;
  }
  get offset() {
    return this._offset;
  }
  get segment() {
    return this._segment;
  }
  get data() {
    return this._data ?? fail2("no data");
  }
  initialPlacement() {
    if (this._org == null)
      return;
    const eligibleSegments = [];
    for (const name2 of this.segments) {
      const s = this.linker.segments.get(name2);
      if (!s)
        throw new Error(`Unknown segment: ${name2}`);
      if (this._org >= s.memory && this._org < s.memory + s.size) {
        eligibleSegments.push(s);
      }
    }
    if (eligibleSegments.length !== 1) {
      throw new Error(`Non-unique segment for ${this.name}:\n${""}Segments: ${this.segments.join(",")}, ${""}org: \$${this.org?.toString(16)}, ${""}offset: \$${this.offset?.toString(16)}\n${""}Eligible: [${eligibleSegments}]`);
    }
    const segment = eligibleSegments[0];
    if (this._org >= segment.memory + segment.size) {
      throw new Error(`Chunk does not fit in segment ${segment.name}`);
    }
    this.place(this._org, segment, this._overwrite);
  }
  place(org, segment, overwrite) {
    this._org = org;
    this._segment = segment;
    const offset = this._offset = org + segment.delta;
    for (const w of this.linker.watches) {
      if (w >= offset && w < offset + this.size)
        fail2("Unable to place");
    }
    binaryInsert(this.linker.placed, (x) => x[0], [offset, this]);
    if (segment.isRam) {
      this.linker.free.delete(offset, offset + this.size);
      for (const [sub, chunk] of this.follow) {
        chunk.resolveSub(sub, false);
      }
      this._data = undefined;
      return;
    }
    const full = this.linker.data;
    const data = this._data ?? fail2(`No data`);
    this._data = undefined;
    if (this.subs.size) {
      full.splice(offset, data.length);
      const sparse = new SparseByteArray;
      sparse.set(0, data);
      for (const sub of this.subs) {
        sparse.splice(sub.offset, sub.size);
      }
      for (const [start, chunk] of sparse.chunks()) {
        full.set(offset + start, ...chunk);
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
        error = `Chunk at ${segment.name}:\$${org.toString(16).padStart(4, "0")} (offset \$${offset.toString(16).padStart(5, "0")} was ${error}`;
        if (!NO_THROW)
          throw new Error(error);
        if (!QUIET)
          console.error(error);
      }
      this.linker.written.add(offset, offset + data.length);
    }
    for (const [sub, chunk] of this.follow) {
      chunk.resolveSub(sub, false);
    }
    this.linker.free.delete(this.offset, this.offset + this.size);
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
    this.deps.add(dep);
  }
  resolveSub(sub, initial) {
    if (!this.subs.has(sub) && !this.selfSubs.has(sub))
      return;
    sub.expr = traverse(sub.expr, (e, rec, p) => {
      if (initial && p?.op === "^" && p.args.length === 1 && e.meta) {
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
      this.writeValue(sub.offset, sub.expr.num, sub.size, sub.expr.meta?.branch, sub.expr.source);
      del = true;
    } else if (sub.expr.op === ".move") {
      if (sub.expr.args.length !== 1)
        throw new Error(`bad .move`);
      const child = sub.expr.args[0];
      if (child.op === "num" && child.meta?.offset != null) {
        const delta = child.meta.offset - (child.meta.rel ? 0 : child.meta.org);
        const start = child.num + delta;
        const slice = this.linker.orig.slice(start, start + sub.size);
        this.writeBytes(sub.offset, Uint8Array.from(slice));
        del = true;
      }
    }
    if (del) {
      this.subs.delete(sub) || this.selfSubs.delete(sub);
      if (!this.subs.size) {
        if (this.linker.unresolvedChunks.delete(this)) {
          this.linker.insertResolved(this);
        }
      }
    }
  }
  writeBytes(offset, bytes) {
    if (this._data) {
      this._data.subarray(offset, offset + bytes.length).set(bytes);
    } else if (this._offset != null) {
      this.linker.data.set(this._offset + offset, bytes);
    } else {
      throw new Error(`Impossible`);
    }
  }
  writeValue(offset, val, size2, isBranch, source) {
    if (isBranch) {
      const min = -(1 << (size2 << 3) - 1);
      const max = (1 << (size2 << 3) - 1) - 1;
      if (val < min || val > max) {
        const at2 = source ? at({ source }) : "";
        throw new Error(`Branch out of range: offset ${val} at \$${(this.org + offset).toString(16)} (valid range: ${min} to ${max})${at2}`);
      }
    } else {
      const bits = size2 << 3;
      if (val != null && (val < -1 << bits || val >= 1 << bits)) {
        const name2 = ["byte", "word", "farword", "dword"][size2 - 1];
        throw new Error(`Not a ${name2}: \$${val.toString(16)} at \$${(this.org + offset).toString(16)}`);
      }
    }
    const bytes = new Uint8Array(size2);
    for (let i = 0;i < size2; i++) {
      bytes[i] = val & 255;
      val >>= 8;
    }
    this.writeBytes(offset, bytes);
  }
}

class Link {
  data = new SparseByteArray;
  orig = new SparseByteArray;
  exports = new Map;
  chunks = [];
  symbols = [];
  debugSymbols = undefined;
  written = new IntervalSet;
  free = new IntervalSet;
  rawSegments = new Map;
  segments = new Map;
  resolvedChunks = [];
  unresolvedChunks = new Set;
  watches = [];
  placed = [];
  initialReport = "";
  insertResolved(chunk) {
    binaryInsert(this.resolvedChunks, (c) => c.size, chunk);
  }
  base(data, offset = 0) {
    this.data.set(offset, data);
    this.orig.set(offset, data);
  }
  readFile(file) {
    const dc = this.chunks.length;
    const ds = this.symbols.length;
    for (const segment of file.segments || []) {
      this.addRawSegment(segment);
    }
    for (const chunk of file.chunks || []) {
      const lc = new LinkChunk(this, this.chunks.length, chunk, dc, ds);
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
  }
  resolveLink(expr) {
    if (expr.op === ".orig" && expr.args?.length === 1) {
      const child = expr.args[0];
      const offset = child.meta?.offset;
      if (offset != null) {
        const num2 = this.orig.get(offset + child.num);
        if (num2 != null)
          return { op: "num", num: num2 };
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
        expr = evaluate({ ...expr, meta: { ...meta, ...meta2 } });
      }
    }
    return expr;
  }
  resolveExpr(expr) {
    expr = traverse(expr, (e, rec) => {
      return this.resolveLink(evaluate(rec(e)));
    });
    if (expr.op === "num" && !expr.meta?.rel)
      return expr.num;
    const at2 = at(expr);
    throw new Error(`Unable to fully resolve expr${at2}`);
  }
  link(signal) {
    for (const [name2, segments] of this.rawSegments) {
      let s = segments[0];
      for (let i = 1;i < segments.length; i++) {
        s = Segment.merge(s, segments[i]);
      }
      this.segments.set(name2, new LinkSegment(s));
    }
    for (const [name2, segments] of this.rawSegments) {
      const s = this.segments.get(name2);
      for (const segment of segments) {
        const free = segment.free;
        for (const [start, end] of free || []) {
          this.free.add(start + s.delta, end + s.delta);
          this.data.splice(start + s.delta, end - start);
        }
      }
    }
    for (const chunk of this.chunks) {
      chunk.initialPlacement();
    }
    if (DEBUG2) {
      this.initialReport = `Initial:\n${this.report(true)}`;
    }
    for (let i = 0;i < this.symbols.length; i++) {
      const symbol = this.symbols[i];
      if (!symbol.expr)
        throw new Error(`Symbol ${i} never resolved`);
      if (symbol.export != null) {
        this.exports.set(symbol.export, i);
      }
    }
    for (const symbol of this.symbols) {
      symbol.expr = this.resolveSymbols(symbol.expr);
    }
    for (const chunk of this.chunks) {
      for (const sub of [...chunk.subs, ...chunk.selfSubs]) {
        sub.expr = this.resolveSymbols(sub.expr);
      }
      for (let i = 0;i < chunk.asserts.length; i++) {
        chunk.asserts[i] = this.resolveSymbols(chunk.asserts[i]);
      }
    }
    for (const c of this.chunks) {
      c.resolveSubs(true);
    }
    const chunks = [...this.chunks];
    chunks.sort((a, b) => b.size - a.size);
    for (const chunk of chunks) {
      chunk.resolveSubs();
      if (chunk.subs.size) {
        this.unresolvedChunks.add(chunk);
      } else {
        this.insertResolved(chunk);
      }
    }
    let count2 = this.resolvedChunks.length + 2 * this.unresolvedChunks.size;
    while (count2) {
      if (signal?.aborted)
        throw new Error("Compilation cancelled");
      const c = this.resolvedChunks.pop();
      if (c) {
        this.placeChunk(c);
      } else {
        const [first] = this.unresolvedChunks;
        for (const dep of first.deps) {
          const chunk = this.chunks[dep];
          if (chunk.org == null)
            this.placeChunk(chunk);
        }
      }
      const next = this.resolvedChunks.length + 2 * this.unresolvedChunks.size;
      if (next === count2) {
        console.error(this.resolvedChunks, this.unresolvedChunks);
        throw new Error(`Not making progress`);
      }
      count2 = next;
    }
    const patch = new SparseByteArray;
    for (const [_name, seg] of this.segments) {
      if (seg.isRam)
        continue;
      if (seg.fill) {
        const buf = new Uint8Array(new ArrayBuffer(seg.size));
        buf.fill(seg.fill);
        patch.set(seg.offset, buf);
      }
    }
    for (const c of this.chunks) {
      for (const a of c.asserts) {
        const v = this.resolveExpr(a);
        if (v)
          continue;
        const at2 = at(a);
        throw new Error(`Assertion failed${at2}`);
      }
      if (c.overlaps)
        continue;
      if (c.segment?.isRam)
        continue;
      patch.set(c.offset, Uint8Array.from(this.data.slice(c.offset, c.offset + c.size)));
    }
    if (DEBUG2)
      console.log(this.report(true));
    return patch;
  }
  placeChunk(chunk) {
    if (chunk.org != null)
      return;
    if (chunk.segments.length == 0) {
      this.rawSegments.forEach((segments, name3) => {
        for (const seg of segments) {
          if (seg.default) {
            chunk.segments = [name3];
            break;
          }
        }
      });
    }
    const size2 = chunk.size;
    if (chunk.size < 256 && !chunk.subs.size && !chunk.selfSubs.size) {
      const pattern = this.data.pattern(chunk.data);
      for (const name3 of chunk.segments) {
        const segment = this.segments.get(name3) ?? fail2(`Segment not found with name: ${name3}`);
        if (segment.isRam)
          continue;
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
    for (const name3 of chunk.segments) {
      const segment = this.segments.get(name3) ?? fail2(`Segment not found with name: ${name3}`);
      const s0 = segment.isRam ? segment.memory + LinkSegment.RAM_OFFSET : segment.offset;
      const s1 = s0 + segment.size;
      let found;
      let smallest = Infinity;
      for (const [f0, f1] of this.free.tail(s0)) {
        if (f0 >= s1)
          break;
        const df = Math.min(f1, s1) - f0;
        if (df < size2)
          continue;
        if (df < smallest) {
          found = f0;
          smallest = df;
        }
      }
      if (found != null) {
        chunk.place(found - segment.delta, segment);
        return;
      }
    }
    if (DEBUG2)
      console.log(`Initial:\n${this.initialReport}`);
    const name2 = chunk.name ? `${chunk.name} ` : "";
    throw new Error(`Could not find space for ${size2}-byte chunk ${name2} in ${chunk.segments.join(", ")}`);
  }
  resolveSymbols(expr) {
    return traverse(expr, (e, rec) => {
      while (e.op === "im" || e.op === "sym") {
        if (e.op === "im") {
          const name2 = e.sym;
          const imported = this.exports.get(name2);
          if (imported == null) {
            const at2 = at(expr);
            throw new Error(`Symbol never exported ${name2}${at2}`);
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
  addRawSegment(segment) {
    let list = this.rawSegments.get(segment.name);
    if (!list)
      this.rawSegments.set(segment.name, list = []);
    list.push(segment);
  }
  buildExports() {
    const map2 = new Map;
    for (const symbol of this.symbols) {
      if (!symbol.export)
        continue;
      const e = traverse(symbol.expr, (e2, rec) => {
        return this.resolveLink(evaluate(rec(e2)));
      });
      if (e.op !== "num")
        throw new Error(`never resolved: ${symbol.export}`);
      const value = e.num;
      const out = { value };
      if (e.meta?.offset != null && e.meta.org != null) {
        out.offset = e.meta.offset + value - e.meta.org;
      }
      if (e.meta?.bank != null)
        out.bank = e.meta.bank;
      map2.set(symbol.export, out);
    }
    return map2;
  }
  report(verbose = false) {
    let out = "";
    for (const [s, e] of this.free) {
      out += `Free: ${s.toString(16)}..${e.toString(16)}: ${e - s} bytes\n`;
    }
    if (verbose) {
      for (const [s, c] of this.placed) {
        const name2 = c.name ?? `Chunk ${c.index}`;
        const end = c.offset + c.size;
        out += `${s.toString(16).padStart(5, "0")} .. ${end.toString(16).padStart(5, "0")}: ${name2} (${end - s} bytes)\n`;
      }
    }
    return out;
  }
}
var DEBUG2 = false;
var NO_THROW = false;
var QUIET = false;

// src/validate_modules.ts
function fail3(path, msg) {
  throw new ValidationError(`${path}: ${msg}`);
}
function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function reqNumber(v, path) {
  if (typeof v !== "number" || Number.isNaN(v))
    fail3(path, "expected number");
  return v;
}
function reqString(v, path) {
  if (typeof v !== "string")
    fail3(path, "expected string");
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
    fail3(path, "expected boolean");
  return v;
}
function reqArray(v, path) {
  if (!Array.isArray(v))
    fail3(path, "expected array");
  return v;
}
function validateSourceInfo(v, path) {
  if (!isObject(v))
    fail3(path, "expected object");
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
    fail3(path, "expected object");
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
  const size2 = optNumber(v.size, `${path}.size`);
  if (size2 !== undefined)
    out.size = size2;
  const branch = optBoolean(v.branch, `${path}.branch`);
  if (branch !== undefined)
    out.branch = branch;
  return out;
}
function validateExpr(v, path) {
  if (!isObject(v))
    fail3(path, "expected object");
  const out = { op: reqString(v.op, `${path}.op`) };
  const num2 = optNumber(v.num, `${path}.num`);
  if (num2 !== undefined)
    out.num = num2;
  const str2 = optString(v.str, `${path}.str`);
  if (str2 !== undefined)
    out.str = str2;
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
function validateSubstitution(v, path) {
  if (!isObject(v))
    fail3(path, "expected object");
  return {
    offset: reqNumber(v.offset, `${path}.offset`),
    size: reqNumber(v.size, `${path}.size`),
    expr: validateExpr(v.expr, `${path}.expr`)
  };
}
function validateSymbol(v, path) {
  if (!isObject(v))
    fail3(path, "expected object");
  const out = {};
  const exp = optString(v.export, `${path}.export`);
  if (exp !== undefined)
    out.export = exp;
  if (v.expr !== undefined)
    out.expr = validateExpr(v.expr, `${path}.expr`);
  return out;
}
function validateChunk(v, path) {
  if (!isObject(v))
    fail3(path, "expected object");
  if (typeof v.data !== "string")
    fail3(`${path}.data`, "expected base64 string");
  let data;
  try {
    data = new Base64().decode(v.data);
  } catch {
    fail3(`${path}.data`, "invalid base64");
  }
  const segments = reqArray(v.segments, `${path}.segments`).map((s, i) => reqString(s, `${path}.segments[${i}]`));
  const out = { segments, data };
  const name2 = optString(v.name, `${path}.name`);
  if (name2 !== undefined)
    out.name = name2;
  const org = optNumber(v.org, `${path}.org`);
  if (org !== undefined)
    out.org = org;
  if (v.subs !== undefined) {
    out.subs = reqArray(v.subs, `${path}.subs`).map((s, i) => validateSubstitution(s, `${path}.subs[${i}]`));
  }
  if (v.asserts !== undefined) {
    out.asserts = reqArray(v.asserts, `${path}.asserts`).map((e, i) => validateExpr(e, `${path}.asserts[${i}]`));
  }
  if (v.overwrite !== undefined) {
    const ow = reqString(v.overwrite, `${path}.overwrite`);
    if (!OVERWRITE_MODES.has(ow))
      fail3(`${path}.overwrite`, `expected one of forbid|allow|require`);
    out.overwrite = ow;
  }
  if (v.sourceMap !== undefined) {
    if (!(v.sourceMap instanceof Map))
      fail3(`${path}.sourceMap`, "expected Map");
    const m = new Map;
    for (const [k, val] of v.sourceMap) {
      m.set(reqNumber(k, `${path}.sourceMap.key`), validateSourceInfo(val, `${path}.sourceMap.value`));
    }
    out.sourceMap = m;
  }
  if (v.labelIndex !== undefined) {
    if (!(v.labelIndex instanceof Map))
      fail3(`${path}.labelIndex`, "expected Map");
    const m = new Map;
    for (const [k, val] of v.labelIndex) {
      m.set(reqString(k, `${path}.labelIndex.key`), reqNumber(val, `${path}.labelIndex.value`));
    }
    out.labelIndex = m;
  }
  return out;
}
function validateSegment(v, path) {
  if (!isObject(v))
    fail3(path, "expected object");
  const out = { name: reqString(v.name, `${path}.name`) };
  const bank = optNumber(v.bank, `${path}.bank`);
  if (bank !== undefined)
    out.bank = bank;
  const size2 = optNumber(v.size, `${path}.size`);
  if (size2 !== undefined)
    out.size = size2;
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
  const overlay = optString(v.overlay, `${path}.overlay`);
  if (overlay !== undefined)
    out.overlay = overlay;
  const def = optBoolean(v.default, `${path}.default`);
  if (def !== undefined)
    out.default = def;
  if (v.free !== undefined) {
    out.free = reqArray(v.free, `${path}.free`).map((row, i) => {
      const r = reqArray(row, `${path}.free[${i}]`);
      return r.map((n, j) => reqNumber(n, `${path}.free[${i}][${j}]`));
    });
  }
  return out;
}
function parseModule(obj) {
  try {
    if (!isObject(obj))
      fail3("module", "expected object");
    const out = {};
    const name2 = optString(obj.name, "module.name");
    if (name2 !== undefined)
      out.name = name2;
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
    return { ok: true, value: out };
  } catch (err) {
    if (err instanceof ValidationError)
      return { ok: false, error: err.message };
    throw err;
  }
}
function validateActionSource(v, path) {
  if (!isObject(v))
    fail3(path, "expected object");
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
    if (isObject(e) && e.op === "sym") {
      return { op: "sym", sym: reqString(e.sym, `${path}[${i}].sym`) };
    }
    fail3(`${path}[${i}]`, 'expected number or {op:"sym",sym}');
  });
}
function validateAction(v, path) {
  if (!isObject(v))
    fail3(path, "expected object");
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
      return withSource({ action: "byte", bytes: validateByteList(v.bytes, `${path}.bytes`) });
    case "word":
      return withSource({ action: "word", words: validateByteList(v.words, `${path}.words`) });
    case "org":
      return withSource({
        action: "org",
        addr: reqNumber(v.addr, `${path}.addr`),
        ...v.name !== undefined ? { name: reqString(v.name, `${path}.name`) } : {}
      });
    case "segment": {
      const name2 = Array.isArray(v.name) ? v.name.map((n, i) => reqString(n, `${path}.name[${i}]`)) : reqString(v.name, `${path}.name`);
      return withSource({ action: "segment", name: name2 });
    }
    case "reloc":
      return withSource({
        action: "reloc",
        ...v.name !== undefined ? { name: reqString(v.name, `${path}.name`) } : {}
      });
    case "export":
      return withSource({ action: "export", name: reqString(v.name, `${path}.name`) });
    case "assign":
    case "set": {
      if (typeof v.value !== "number" && typeof v.value !== "string") {
        fail3(`${path}.value`, "expected number or string");
      }
      return withSource({
        action,
        name: reqString(v.name, `${path}.name`),
        value: v.value
      });
    }
    case "free":
      return withSource({ action: "free", size: reqNumber(v.size, `${path}.size`) });
    default:
      fail3(`${path}.action`, `unknown action "${action}"`);
  }
}
function validateInput(v, path) {
  if (!isObject(v))
    fail3(path, "expected object");
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
        fail3(`${path}.module`, mod.error);
      return { type: "module", module: mod.value };
    }
    case "actions": {
      const actions = reqArray(v.actions, `${path}.actions`).map((a, i) => validateAction(a, `${path}.actions[${i}]`));
      const name2 = optString(v.name, `${path}.name`);
      return name2 !== undefined ? { type: "actions", actions, name: name2 } : { type: "actions", actions };
    }
    default:
      fail3(`${path}.type`, `unknown input type "${type}"`);
  }
}
function parseInputs(arr) {
  const inputs = reqArray(arr, "inputs");
  return inputs.map((v, i) => validateInput(v, `inputs[${i}]`));
}
function validateOptions(v, path) {
  if (v === undefined)
    return {};
  if (!isObject(v))
    fail3(path, "expected object");
  const out = {};
  if (v.includePaths !== undefined) {
    out.includePaths = reqArray(v.includePaths, `${path}.includePaths`).map((s, i) => reqString(s, `${path}.includePaths[${i}]`));
  }
  const lineContinuations = optBoolean(v.lineContinuations, `${path}.lineContinuations`);
  if (lineContinuations !== undefined)
    out.lineContinuations = lineContinuations;
  const numberSeparators = optBoolean(v.numberSeparators, `${path}.numberSeparators`);
  if (numberSeparators !== undefined)
    out.numberSeparators = numberSeparators;
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
  if (v.outputFormat !== undefined) {
    const fmt = reqString(v.outputFormat, `${path}.outputFormat`);
    if (!OUTPUT_FORMATS.has(fmt))
      fail3(`${path}.outputFormat`, "expected one of binary|ips|object");
    out.outputFormat = fmt;
  }
  return out;
}
function parseRequest(obj) {
  try {
    if (!isObject(obj))
      fail3("request", "expected object");
    const inputs = parseInputs(obj.inputs);
    const options = validateOptions(obj.options, "request.options");
    return { ok: true, value: { inputs, options } };
  } catch (err) {
    if (err instanceof ValidationError)
      return { ok: false, error: err.message };
    throw err;
  }
}

class ValidationError extends Error {
}
var OVERWRITE_MODES = new Set(["forbid", "allow", "require"]);
var OUTPUT_FORMATS = new Set(["binary", "ips", "object"]);

// src/libassembler.ts
function throwIfCancelled(signal) {
  if (signal?.aborted)
    throw new Error("Compilation cancelled");
}
function toSourceInfo(source) {
  if (!source)
    return;
  return { file: source.file, line: source.line, column: 0 };
}
async function assemble(inputs, options, callbacks, sourceContents, signal) {
  const modules = [];
  const allMessages = [];
  const opts = {
    includePaths: options?.includePaths || [],
    lineContinuations: options?.lineContinuations ?? true,
    numberSeparators: options?.numberSeparators,
    generateDebugInfo: options?.generateDebugInfo
  };
  const asmOpts = {
    generateDebugInfo: options?.generateDebugInfo
  };
  for (let i = 0;i < inputs.length; i++) {
    throwIfCancelled(signal);
    const input = inputs[i];
    if (input.type === "module") {
      modules.push(input.module);
      continue;
    }
    if (input.type === "actions") {
      const asm2 = new Assembler(Cpu.P02, asmOpts);
      let module_name = input.name ?? `module_${i}`;
      const original_module_name = module_name;
      for (const action of input.actions) {
        asm2.setSource(toSourceInfo(action.source));
        switch (action.action) {
          case "code": {
            const toks2 = new TokenStream(callbacks?.readText, callbacks?.readBinary, opts, sourceContents);
            if (module_name === original_module_name && action.name) {
              module_name = action.name;
            }
            const tokenizer2 = new Tokenizer(action.code, module_name, opts, sourceContents, asm2.errorCollector);
            toks2.enter(tokenizer2);
            const pre2 = new Preprocessor(toks2, asm2, undefined, asm2.errorCollector);
            await asm2.tokens(pre2, signal);
            break;
          }
          case "label":
            asm2.label(action.label);
            break;
          case "byte":
            asm2.byte(...action.bytes);
            break;
          case "word":
            asm2.word(...action.words);
            break;
          case "org":
            asm2.org(action.addr, action.name);
            break;
          case "segment":
            asm2.segment(...action.name);
            break;
          case "reloc":
            asm2.reloc(action.name);
            break;
          case "export":
            asm2.export(action.name);
            break;
          case "assign": {
            const value = typeof action.value === "string" ? parseInt(action.value, 10) : action.value;
            asm2.assign(action.name, value);
            break;
          }
          case "set": {
            const value = typeof action.value === "string" ? parseInt(action.value, 10) : action.value;
            asm2.set(action.name, value);
            break;
          }
          case "free":
            asm2.free(action.size);
            break;
          default:
            console.warn(`Unknown action type:`, action);
        }
      }
      const module2 = asm2.module();
      module2.name = module_name;
      modules.push(module2);
      allMessages.push(...asm2.getMessages());
      continue;
    }
    const asm = new Assembler(Cpu.P02, asmOpts);
    const toks = new TokenStream(callbacks?.readText, callbacks?.readBinary, opts, sourceContents);
    try {
      const obj = JSON.parse(input.code);
      const parsedModule = parseModule(obj);
      if (parsedModule.ok) {
        modules.push(parsedModule.value);
        continue;
      }
    } catch (_err) {
    }
    const tokenizer = new Tokenizer(input.code, input.name, opts, sourceContents, asm.errorCollector);
    toks.enter(tokenizer);
    const pre = new Preprocessor(toks, asm, undefined, asm.errorCollector);
    await asm.tokens(pre, signal);
    const module = asm.module();
    module.name = input.name;
    modules.push(module);
    allMessages.push(...asm.getMessages());
  }
  const hasErrors = allMessages.some((m) => m.level === "error");
  return { success: !hasErrors, modules, messages: allMessages };
}
function link(modules, options, outputFormat = "binary", sourceContents, messages = [], signal) {
  const allMessages = [...messages];
  try {
    const linker = new Linker({ target: options?.target });
    let data = null;
    if (outputFormat !== "ips" && options?.baseRom) {
      data = options.baseRom;
      linker.base(data, options.baseRomOffset ?? 0);
    }
    for (const module of modules) {
      linker.read(module);
    }
    const out = linker.link(signal);
    let binaryData;
    if (outputFormat === "ips") {
      binaryData = out.toIpsPatch();
    } else {
      if (!data)
        data = new Uint8Array(out.length);
      out.apply(data);
      binaryData = data;
    }
    const debugInfo = linker.getDebugInfo(sourceContents, options?.debugLevel ?? 0);
    const hasErrors = allMessages.some((m) => m.level === "error");
    return {
      success: !hasErrors,
      data: binaryData,
      debugInfo,
      messages: allMessages
    };
  } catch (err) {
    allMessages.push({
      level: "error",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    return {
      success: false,
      data: new Uint8Array(0),
      debugInfo: "",
      messages: allMessages
    };
  }
}
function findOutput(result, type) {
  return result.outputs.find((o) => o.type === type);
}
function failureFromException(err) {
  return {
    success: false,
    outputs: [],
    messages: [{
      level: "error",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    }]
  };
}
function serializeModule(m) {
  const base64 = new Base64;
  return JSON.stringify(m, (k, v) => {
    if (k === "data" && v instanceof Uint8Array) {
      return base64.encode(v);
    }
    return v;
  }, "  ");
}
function deserializeRequest(requestJson) {
  const base64 = new Base64;
  const parsed = JSON.parse(requestJson, (key, value) => (key === "bytes" || key === "words") && typeof value === "string" ? base64.decode(value) : value);
  const validated = parseRequest(parsed);
  if (!validated.ok)
    throw new Error(`Invalid compile request: ${validated.error}`);
  return validated.value;
}
async function compile(inputs, options = {}, callbacks, baseRom, signal) {
  const base64 = new Base64;
  try {
    throwIfCancelled(signal);
    const asmOpts = {
      includePaths: options.includePaths,
      lineContinuations: options.lineContinuations,
      numberSeparators: options.numberSeparators,
      generateDebugInfo: options.generateDebugInfo
    };
    const linkerOpts = {
      target: options.target,
      baseRom,
      baseRomOffset: options.baseRomOffset,
      debugLevel: options.debugLevel
    };
    const outputFormat = options.outputFormat ?? "binary";
    const sourceContents = options.generateDebugInfo ? new SourceContents : undefined;
    const fileCallbacks = {
      readText: async (basePath, relPath) => {
        if (!callbacks?.readText)
          throw new Error(`No readText callback provided (reading ${basePath}/${relPath})`);
        return await callbacks.readText(basePath, relPath);
      },
      readBinary: async (basePath, relPath) => {
        if (!callbacks?.readBinary)
          throw new Error(`No readBinary callback provided (reading ${basePath}/${relPath})`);
        const data = await callbacks.readBinary(basePath, relPath);
        return typeof data === "string" ? base64.decode(data) : data;
      }
    };
    const asm = await assemble(inputs, asmOpts, fileCallbacks, sourceContents, signal);
    if (!asm.success) {
      return { success: false, outputs: [], messages: asm.messages };
    }
    if (outputFormat === "object") {
      const outputs2 = asm.modules.map((m) => ({
        name: `${m.name || "module"}.o`,
        data: new TextEncoder().encode(serializeModule(m)),
        type: "object"
      }));
      return { success: true, outputs: outputs2, messages: asm.messages };
    }
    const lr = link(asm.modules, linkerOpts, outputFormat, sourceContents, asm.messages, signal);
    const outputName = outputFormat === "ips" ? "out.ips" : "out.nes";
    const outputs = [{ name: outputName, data: lr.data, type: "binary" }];
    if (lr.debugInfo) {
      outputs.push({ name: "out.mlb", data: new TextEncoder().encode(lr.debugInfo), type: "debug" });
    }
    return {
      success: lr.success,
      outputs,
      messages: lr.messages
    };
  } catch (err) {
    return failureFromException(err);
  }
}
async function compileRequest(requestJson, callbacks, baseRom, signal) {
  try {
    const { inputs, options } = deserializeRequest(requestJson);
    return await compile(inputs, options, callbacks, baseRom, signal);
  } catch (err) {
    return failureFromException(err);
  }
}
async function compileBrowser(requestJson, readText, readBinaryBase64, baseRom, shouldCancel) {
  const base64 = new Base64;
  const callbacks = {
    readText: async (basePath, relPath) => readText(basePath, relPath),
    readBinary: async (basePath, relPath) => base64.decode(await readBinaryBase64(basePath, relPath))
  };
  const rom = baseRom && baseRom.length > 0 ? baseRom instanceof Uint8Array ? baseRom : new Uint8Array(Array.from(baseRom)) : undefined;
  const signal = shouldCancel ? { get aborted() {
    return shouldCancel();
  } } : undefined;
  const result = await compileRequest(requestJson, callbacks, rom, signal);
  const resultJson = JSON.stringify({
    success: result.success,
    outputs: result.outputs.map((o) => ({ name: o.name, data: base64.encode(o.data), type: o.type })),
    messages: result.messages
  });
  return base64.encode(new TextEncoder().encode(resultJson));
}
export {
  link,
  findOutput,
  deserializeRequest,
  compileRequest,
  compileBrowser,
  compile,
  assemble,
  SourceContents,
  Cpu,
  Base64,
  Assembler
};

//# debugId=BE1A4AEC4178A6B764756E2164756E21
//# sourceMappingURL=libassembler.js.map
