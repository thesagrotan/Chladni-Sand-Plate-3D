(module
 (type $0 (func (param f64) (result f64)))
 (type $1 (func (param f32 f32 f32 f32 f32 f32 f32 f32 f32 f32) (result f32)))
 (type $2 (func))
 (type $3 (func (param f64 f64) (result f64)))
 (type $4 (func (param i64) (result i32)))
 (type $5 (func (param i32 i32 i32 i32)))
 (type $6 (func (param f32 f32 f32 f32 f32 f32 f32) (result f32)))
 (type $7 (func (param i32)))
 (type $8 (func (param i32) (result i32)))
 (type $9 (func (param i32 i32) (result i32)))
 (type $10 (func (param i32 i32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32) (result i32)))
 (type $11 (func (param i32 f32 f32 f32 f32 f32 f32 f32 f32 f32) (result f32)))
 (type $12 (func (param i32 f32 f32 f32 f32 f32 f32 f32 f32) (result f32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~lib/math/rempio2_y0 (mut f64) (f64.const 0))
 (global $~lib/math/rempio2_y1 (mut f64) (f64.const 0))
 (global $~lib/math/res128_hi (mut i64) (i64.const 0))
 (global $~lib/rt/stub/offset (mut i32) (i32.const 0))
 (global $~lib/rt/__rtti_base i32 (i32.const 1360))
 (memory $0 16 256)
 (data $0 (i32.const 1024) "n\83\f9\a2\00\00\00\00\d1W\'\fc)\15DN\99\95b\db\c0\dd4\f5\abcQ\feA\90C<:n$\b7a\c5\bb\de\ea.I\06\e0\d2MB\1c\eb\1d\fe\1c\92\d1\t\f55\82\e8>\a7)\b1&p\9c\e9\84D\bb.9\d6\919A~_\b4\8b_\84\9c\f49S\83\ff\97\f8\1f;(\f9\bd\8b\11/\ef\0f\98\05\de\cf~6m\1fm\nZf?FO\b7\t\cb\'\c7\ba\'u-\ea_\9e\f79\07={\f1\e5\eb\b1_\fbk\ea\92R\8aF0\03V\08]\8d\1f \bc\cf\f0\abk{\fca\91\e3\a9\1d6\f4\9a_\85\99e\08\1b\e6^\80\d8\ff\8d@h\a0\14W\15\06\061\'sM")
 (data $1 (i32.const 1228) "<")
 (data $1.1 (i32.const 1240) "\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e")
 (data $2 (i32.const 1292) "<")
 (data $2.1 (i32.const 1304) "\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00s\00t\00u\00b\00.\00t\00s")
 (data $3 (i32.const 1360) "\04\00\00\00 \00\00\00 \00\00\00 ")
 (export "evalBaseWave" (func $src/simulation/wasm/chladni.as/evalBaseWave))
 (export "evalChladniW" (func $src/simulation/wasm/chladni.as/evalChladniW))
 (export "evalChladniGradX" (func $src/simulation/wasm/chladni.as/evalChladniGradX))
 (export "evalChladniGradY" (func $src/simulation/wasm/chladni.as/evalChladniGradY))
 (export "benchmarkChladniBatch" (func $src/simulation/wasm/chladni.as/benchmarkChladniBatch))
 (export "computeActiveFractionWasm" (func $src/simulation/wasm/chladni.as/computeActiveFractionWasm))
 (export "stepParticlesWasm" (func $src/simulation/wasm/chladni.as/stepParticlesWasm))
 (export "__new" (func $~lib/rt/stub/__new))
 (export "__pin" (func $~lib/rt/stub/__pin))
 (export "__unpin" (func $~lib/rt/stub/__unpin))
 (export "__collect" (func $~lib/rt/stub/__collect))
 (export "__rtti_base" (global $~lib/rt/__rtti_base))
 (export "memory" (memory $0))
 (start $~start)
 (func $~lib/math/NativeMath.cos (param $0 f64) (result f64)
  (local $1 f64)
  (local $2 f64)
  (local $3 i32)
  (local $4 i32)
  (local $5 i64)
  (local $6 i32)
  (local $7 f64)
  (local $8 f64)
  (local $9 f64)
  local.get $0
  i64.reinterpret_f64
  local.tee $5
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  local.tee $3
  i32.const 31
  i32.shr_u
  local.set $6
  local.get $3
  i32.const 2147483647
  i32.and
  local.tee $3
  i32.const 1072243195
  i32.le_u
  if
   local.get $3
   i32.const 1044816030
   i32.lt_u
   if
    f64.const 1
    return
   end
   local.get $0
   local.get $0
   f64.mul
   local.tee $1
   local.get $1
   f64.mul
   local.set $2
   f64.const 1
   local.get $1
   f64.const 0.5
   f64.mul
   local.tee $7
   f64.sub
   local.tee $8
   f64.const 1
   local.get $8
   f64.sub
   local.get $7
   f64.sub
   local.get $1
   local.get $1
   local.get $1
   local.get $1
   f64.const 2.480158728947673e-05
   f64.mul
   f64.const -0.001388888888887411
   f64.add
   f64.mul
   f64.const 0.0416666666666666
   f64.add
   f64.mul
   local.get $2
   local.get $2
   f64.mul
   local.get $1
   local.get $1
   f64.const -1.1359647557788195e-11
   f64.mul
   f64.const 2.087572321298175e-09
   f64.add
   f64.mul
   f64.const -2.7557314351390663e-07
   f64.add
   f64.mul
   f64.add
   f64.mul
   local.get $0
   f64.const 0
   f64.mul
   f64.sub
   f64.add
   f64.add
   return
  end
  local.get $3
  i32.const 2146435072
  i32.ge_u
  if
   local.get $0
   local.get $0
   f64.sub
   return
  end
  block $~lib/math/rempio2|inlined.0 (result i32)
   local.get $5
   i64.const 32
   i64.shr_u
   i32.wrap_i64
   i32.const 2147483647
   i32.and
   local.tee $4
   i32.const 1073928572
   i32.lt_u
   if
    i32.const 1
    local.set $3
    local.get $6
    if (result f64)
     local.get $0
     f64.const 1.5707963267341256
     f64.add
     local.set $0
     i32.const -1
     local.set $3
     local.get $4
     i32.const 1073291771
     i32.ne
     if (result f64)
      local.get $0
      local.get $0
      f64.const 6.077100506506192e-11
      f64.add
      local.tee $0
      f64.sub
      f64.const 6.077100506506192e-11
      f64.add
     else
      local.get $0
      f64.const 6.077100506303966e-11
      f64.add
      local.tee $1
      f64.const 2.0222662487959506e-21
      f64.add
      local.set $0
      local.get $1
      local.get $0
      f64.sub
      f64.const 2.0222662487959506e-21
      f64.add
     end
    else
     local.get $0
     f64.const -1.5707963267341256
     f64.add
     local.set $0
     local.get $4
     i32.const 1073291771
     i32.ne
     if (result f64)
      local.get $0
      local.get $0
      f64.const -6.077100506506192e-11
      f64.add
      local.tee $0
      f64.sub
      f64.const -6.077100506506192e-11
      f64.add
     else
      local.get $0
      f64.const -6.077100506303966e-11
      f64.add
      local.tee $1
      f64.const -2.0222662487959506e-21
      f64.add
      local.set $0
      local.get $1
      local.get $0
      f64.sub
      f64.const -2.0222662487959506e-21
      f64.add
     end
    end
    local.get $0
    global.set $~lib/math/rempio2_y0
    global.set $~lib/math/rempio2_y1
    local.get $3
    br $~lib/math/rempio2|inlined.0
   end
   local.get $4
   i32.const 1094263291
   i32.lt_u
   if
    local.get $4
    i32.const 20
    i32.shr_u
    local.tee $3
    local.get $0
    local.get $0
    f64.const 0.6366197723675814
    f64.mul
    f64.nearest
    local.tee $7
    f64.const 1.5707963267341256
    f64.mul
    f64.sub
    local.tee $0
    local.get $7
    f64.const 6.077100506506192e-11
    f64.mul
    local.tee $2
    f64.sub
    local.tee $1
    i64.reinterpret_f64
    i64.const 32
    i64.shr_u
    i32.wrap_i64
    i32.const 20
    i32.shr_u
    i32.const 2047
    i32.and
    i32.sub
    i32.const 16
    i32.gt_u
    if
     local.get $7
     f64.const 2.0222662487959506e-21
     f64.mul
     local.get $0
     local.get $0
     local.get $7
     f64.const 6.077100506303966e-11
     f64.mul
     local.tee $1
     f64.sub
     local.tee $0
     f64.sub
     local.get $1
     f64.sub
     f64.sub
     local.set $2
     local.get $3
     local.get $0
     local.get $2
     f64.sub
     local.tee $1
     i64.reinterpret_f64
     i64.const 32
     i64.shr_u
     i32.wrap_i64
     i32.const 20
     i32.shr_u
     i32.const 2047
     i32.and
     i32.sub
     i32.const 49
     i32.gt_u
     if
      local.get $7
      f64.const 8.4784276603689e-32
      f64.mul
      local.get $0
      local.get $0
      local.get $7
      f64.const 2.0222662487111665e-21
      f64.mul
      local.tee $1
      f64.sub
      local.tee $0
      f64.sub
      local.get $1
      f64.sub
      f64.sub
      local.set $2
      local.get $0
      local.get $2
      f64.sub
      local.set $1
     end
    end
    local.get $1
    global.set $~lib/math/rempio2_y0
    local.get $0
    local.get $1
    f64.sub
    local.get $2
    f64.sub
    global.set $~lib/math/rempio2_y1
    local.get $7
    i32.trunc_sat_f64_s
    br $~lib/math/rempio2|inlined.0
   end
   i32.const 0
   local.get $5
   call $~lib/math/pio2_large_quot
   local.tee $3
   i32.sub
   local.get $3
   local.get $6
   select
  end
  local.set $3
  global.get $~lib/math/rempio2_y0
  local.set $1
  global.get $~lib/math/rempio2_y1
  local.set $2
  local.get $3
  i32.const 1
  i32.and
  if (result f64)
   local.get $1
   local.get $1
   f64.mul
   local.tee $0
   local.get $1
   f64.mul
   local.set $7
   local.get $1
   local.get $0
   local.get $2
   f64.const 0.5
   f64.mul
   local.get $7
   local.get $0
   local.get $0
   f64.const 2.7557313707070068e-06
   f64.mul
   f64.const -1.984126982985795e-04
   f64.add
   f64.mul
   f64.const 0.00833333333332249
   f64.add
   local.get $0
   local.get $0
   local.get $0
   f64.mul
   f64.mul
   local.get $0
   f64.const 1.58969099521155e-10
   f64.mul
   f64.const -2.5050760253406863e-08
   f64.add
   f64.mul
   f64.add
   f64.mul
   f64.sub
   f64.mul
   local.get $2
   f64.sub
   local.get $7
   f64.const -0.16666666666666632
   f64.mul
   f64.sub
   f64.sub
  else
   local.get $1
   local.get $1
   f64.mul
   local.tee $7
   local.get $7
   f64.mul
   local.set $8
   f64.const 1
   local.get $7
   f64.const 0.5
   f64.mul
   local.tee $0
   f64.sub
   local.tee $9
   f64.const 1
   local.get $9
   f64.sub
   local.get $0
   f64.sub
   local.get $7
   local.get $7
   local.get $7
   local.get $7
   f64.const 2.480158728947673e-05
   f64.mul
   f64.const -0.001388888888887411
   f64.add
   f64.mul
   f64.const 0.0416666666666666
   f64.add
   f64.mul
   local.get $8
   local.get $8
   f64.mul
   local.get $7
   local.get $7
   f64.const -1.1359647557788195e-11
   f64.mul
   f64.const 2.087572321298175e-09
   f64.add
   f64.mul
   f64.const -2.7557314351390663e-07
   f64.add
   f64.mul
   f64.add
   f64.mul
   local.get $1
   local.get $2
   f64.mul
   f64.sub
   f64.add
   f64.add
  end
  local.tee $0
  f64.neg
  local.get $0
  local.get $3
  i32.const 1
  i32.add
  i32.const 2
  i32.and
  select
 )
 (func $src/simulation/wasm/chladni.as/evalChladniW (param $0 f32) (param $1 f32) (param $2 f32) (param $3 f32) (param $4 f32) (param $5 f32) (param $6 f32) (param $7 f32) (param $8 f32) (param $9 f32) (result f32)
  local.get $0
  local.get $1
  local.get $2
  local.get $3
  local.get $4
  local.get $5
  local.get $6
  call $src/simulation/wasm/chladni.as/evalBaseWave
  local.set $2
  local.get $7
  f32.const 0.009999999776482582
  f32.gt
  if
   local.get $0
   f64.promote_f32
   f64.abs
   f32.demote_f64
   local.set $3
   local.get $1
   f64.promote_f32
   f64.abs
   f32.demote_f64
   local.set $4
   local.get $8
   f32.const 0.5
   f32.gt
   if (result f64)
    local.get $3
    f64.promote_f32
    local.get $4
    f64.promote_f32
    f64.max
   else
    local.get $0
    local.get $0
    f32.mul
    local.get $1
    local.get $1
    f32.mul
    f32.add
    f64.promote_f32
    f64.sqrt
   end
   f32.demote_f64
   local.tee $0
   local.get $7
   f32.div
   f64.promote_f32
   f64.const 1
   f64.min
   f64.const 0
   f64.max
   f32.demote_f64
   f32.const 1.5707963705062866
   f32.mul
   f64.promote_f32
   call $~lib/math/NativeMath.cos
   f32.demote_f64
   local.get $9
   f32.const 0.6000000238418579
   f32.mul
   f32.const 1.600000023841858
   f32.add
   f32.mul
   f32.const 1
   local.get $0
   local.get $7
   f32.const 0.75
   f32.mul
   local.tee $0
   f32.sub
   local.get $7
   f32.const 1.0499999523162842
   f32.mul
   local.get $0
   f32.sub
   f32.div
   f64.promote_f32
   f64.const 1
   f64.min
   f64.const 0
   f64.max
   f32.demote_f64
   local.tee $0
   local.get $0
   f32.mul
   f32.const 3
   local.get $0
   local.get $0
   f32.add
   f32.sub
   f32.mul
   local.tee $0
   f32.sub
   f32.mul
   local.get $2
   local.get $0
   f32.mul
   f32.add
   return
  end
  local.get $2
 )
 (func $~lib/math/NativeMath.sin (param $0 f64) (result f64)
  (local $1 f64)
  (local $2 f64)
  (local $3 i32)
  (local $4 i32)
  (local $5 i64)
  (local $6 i32)
  (local $7 f64)
  (local $8 f64)
  (local $9 f64)
  local.get $0
  i64.reinterpret_f64
  local.tee $5
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  local.tee $3
  i32.const 31
  i32.shr_u
  local.set $6
  local.get $3
  i32.const 2147483647
  i32.and
  local.tee $3
  i32.const 1072243195
  i32.le_u
  if
   local.get $3
   i32.const 1045430272
   i32.lt_u
   if
    local.get $0
    return
   end
   local.get $0
   local.get $0
   local.get $0
   f64.mul
   local.tee $1
   local.get $0
   f64.mul
   local.get $1
   local.get $1
   local.get $1
   f64.const 2.7557313707070068e-06
   f64.mul
   f64.const -1.984126982985795e-04
   f64.add
   f64.mul
   f64.const 0.00833333333332249
   f64.add
   local.get $1
   local.get $1
   local.get $1
   f64.mul
   f64.mul
   local.get $1
   f64.const 1.58969099521155e-10
   f64.mul
   f64.const -2.5050760253406863e-08
   f64.add
   f64.mul
   f64.add
   f64.mul
   f64.const -0.16666666666666632
   f64.add
   f64.mul
   f64.add
   return
  end
  local.get $3
  i32.const 2146435072
  i32.ge_u
  if
   local.get $0
   local.get $0
   f64.sub
   return
  end
  block $~lib/math/rempio2|inlined.1 (result i32)
   local.get $5
   i64.const 32
   i64.shr_u
   i32.wrap_i64
   i32.const 2147483647
   i32.and
   local.tee $4
   i32.const 1073928572
   i32.lt_u
   if
    i32.const 1
    local.set $3
    local.get $6
    if (result f64)
     local.get $0
     f64.const 1.5707963267341256
     f64.add
     local.set $0
     i32.const -1
     local.set $3
     local.get $4
     i32.const 1073291771
     i32.ne
     if (result f64)
      local.get $0
      local.get $0
      f64.const 6.077100506506192e-11
      f64.add
      local.tee $0
      f64.sub
      f64.const 6.077100506506192e-11
      f64.add
     else
      local.get $0
      f64.const 6.077100506303966e-11
      f64.add
      local.tee $1
      f64.const 2.0222662487959506e-21
      f64.add
      local.set $0
      local.get $1
      local.get $0
      f64.sub
      f64.const 2.0222662487959506e-21
      f64.add
     end
    else
     local.get $0
     f64.const -1.5707963267341256
     f64.add
     local.set $0
     local.get $4
     i32.const 1073291771
     i32.ne
     if (result f64)
      local.get $0
      local.get $0
      f64.const -6.077100506506192e-11
      f64.add
      local.tee $0
      f64.sub
      f64.const -6.077100506506192e-11
      f64.add
     else
      local.get $0
      f64.const -6.077100506303966e-11
      f64.add
      local.tee $1
      f64.const -2.0222662487959506e-21
      f64.add
      local.set $0
      local.get $1
      local.get $0
      f64.sub
      f64.const -2.0222662487959506e-21
      f64.add
     end
    end
    local.get $0
    global.set $~lib/math/rempio2_y0
    global.set $~lib/math/rempio2_y1
    local.get $3
    br $~lib/math/rempio2|inlined.1
   end
   local.get $4
   i32.const 1094263291
   i32.lt_u
   if
    local.get $4
    i32.const 20
    i32.shr_u
    local.tee $3
    local.get $0
    local.get $0
    f64.const 0.6366197723675814
    f64.mul
    f64.nearest
    local.tee $7
    f64.const 1.5707963267341256
    f64.mul
    f64.sub
    local.tee $0
    local.get $7
    f64.const 6.077100506506192e-11
    f64.mul
    local.tee $2
    f64.sub
    local.tee $1
    i64.reinterpret_f64
    i64.const 32
    i64.shr_u
    i32.wrap_i64
    i32.const 20
    i32.shr_u
    i32.const 2047
    i32.and
    i32.sub
    i32.const 16
    i32.gt_u
    if
     local.get $7
     f64.const 2.0222662487959506e-21
     f64.mul
     local.get $0
     local.get $0
     local.get $7
     f64.const 6.077100506303966e-11
     f64.mul
     local.tee $1
     f64.sub
     local.tee $0
     f64.sub
     local.get $1
     f64.sub
     f64.sub
     local.set $2
     local.get $3
     local.get $0
     local.get $2
     f64.sub
     local.tee $1
     i64.reinterpret_f64
     i64.const 32
     i64.shr_u
     i32.wrap_i64
     i32.const 20
     i32.shr_u
     i32.const 2047
     i32.and
     i32.sub
     i32.const 49
     i32.gt_u
     if
      local.get $7
      f64.const 8.4784276603689e-32
      f64.mul
      local.get $0
      local.get $0
      local.get $7
      f64.const 2.0222662487111665e-21
      f64.mul
      local.tee $1
      f64.sub
      local.tee $0
      f64.sub
      local.get $1
      f64.sub
      f64.sub
      local.set $2
      local.get $0
      local.get $2
      f64.sub
      local.set $1
     end
    end
    local.get $1
    global.set $~lib/math/rempio2_y0
    local.get $0
    local.get $1
    f64.sub
    local.get $2
    f64.sub
    global.set $~lib/math/rempio2_y1
    local.get $7
    i32.trunc_sat_f64_s
    br $~lib/math/rempio2|inlined.1
   end
   i32.const 0
   local.get $5
   call $~lib/math/pio2_large_quot
   local.tee $3
   i32.sub
   local.get $3
   local.get $6
   select
  end
  local.set $3
  global.get $~lib/math/rempio2_y0
  local.set $2
  global.get $~lib/math/rempio2_y1
  local.set $7
  local.get $3
  i32.const 1
  i32.and
  if (result f64)
   local.get $2
   local.get $2
   f64.mul
   local.tee $0
   local.get $0
   f64.mul
   local.set $1
   f64.const 1
   local.get $0
   f64.const 0.5
   f64.mul
   local.tee $8
   f64.sub
   local.tee $9
   f64.const 1
   local.get $9
   f64.sub
   local.get $8
   f64.sub
   local.get $0
   local.get $0
   local.get $0
   local.get $0
   f64.const 2.480158728947673e-05
   f64.mul
   f64.const -0.001388888888887411
   f64.add
   f64.mul
   f64.const 0.0416666666666666
   f64.add
   f64.mul
   local.get $1
   local.get $1
   f64.mul
   local.get $0
   local.get $0
   f64.const -1.1359647557788195e-11
   f64.mul
   f64.const 2.087572321298175e-09
   f64.add
   f64.mul
   f64.const -2.7557314351390663e-07
   f64.add
   f64.mul
   f64.add
   f64.mul
   local.get $2
   local.get $7
   f64.mul
   f64.sub
   f64.add
   f64.add
  else
   local.get $2
   local.get $2
   f64.mul
   local.tee $0
   local.get $2
   f64.mul
   local.set $1
   local.get $2
   local.get $0
   local.get $7
   f64.const 0.5
   f64.mul
   local.get $1
   local.get $0
   local.get $0
   f64.const 2.7557313707070068e-06
   f64.mul
   f64.const -1.984126982985795e-04
   f64.add
   f64.mul
   f64.const 0.00833333333332249
   f64.add
   local.get $0
   local.get $0
   local.get $0
   f64.mul
   f64.mul
   local.get $0
   f64.const 1.58969099521155e-10
   f64.mul
   f64.const -2.5050760253406863e-08
   f64.add
   f64.mul
   f64.add
   f64.mul
   f64.sub
   f64.mul
   local.get $7
   f64.sub
   local.get $1
   f64.const -0.16666666666666632
   f64.mul
   f64.sub
   f64.sub
  end
  local.tee $0
  f64.neg
  local.get $0
  local.get $3
  i32.const 2
  i32.and
  select
 )
 (func $src/simulation/wasm/chladni.as/evalChladniGradY (param $0 f32) (param $1 f32) (param $2 f32) (param $3 f32) (param $4 f32) (param $5 f32) (param $6 f32) (param $7 f32) (param $8 f32) (param $9 f32) (result f32)
  local.get $0
  local.get $1
  f32.const 0.001500000013038516
  f32.add
  local.get $2
  local.get $3
  local.get $4
  local.get $5
  local.get $6
  local.get $7
  local.get $8
  local.get $9
  call $src/simulation/wasm/chladni.as/evalChladniW
  local.get $0
  local.get $1
  f32.const -0.001500000013038516
  f32.add
  local.get $2
  local.get $3
  local.get $4
  local.get $5
  local.get $6
  local.get $7
  local.get $8
  local.get $9
  call $src/simulation/wasm/chladni.as/evalChladniW
  f32.sub
  f32.const 0.003000000026077032
  f32.div
 )
 (func $src/simulation/wasm/chladni.as/evalChladniGradX (param $0 f32) (param $1 f32) (param $2 f32) (param $3 f32) (param $4 f32) (param $5 f32) (param $6 f32) (param $7 f32) (param $8 f32) (param $9 f32) (result f32)
  local.get $0
  f32.const 0.001500000013038516
  f32.add
  local.get $1
  local.get $2
  local.get $3
  local.get $4
  local.get $5
  local.get $6
  local.get $7
  local.get $8
  local.get $9
  call $src/simulation/wasm/chladni.as/evalChladniW
  local.get $0
  f32.const -0.001500000013038516
  f32.add
  local.get $1
  local.get $2
  local.get $3
  local.get $4
  local.get $5
  local.get $6
  local.get $7
  local.get $8
  local.get $9
  call $src/simulation/wasm/chladni.as/evalChladniW
  f32.sub
  f32.const 0.003000000026077032
  f32.div
 )
 (func $~lib/math/NativeMath.atan2 (param $0 f64) (param $1 f64) (result f64)
  (local $2 i32)
  (local $3 i64)
  (local $4 i32)
  (local $5 i64)
  (local $6 i32)
  (local $7 i32)
  local.get $0
  local.get $0
  f64.ne
  local.get $1
  local.get $1
  f64.ne
  i32.or
  if
   local.get $1
   local.get $0
   f64.add
   return
  end
  local.get $0
  i64.reinterpret_f64
  local.tee $3
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  local.set $7
  local.get $1
  i64.reinterpret_f64
  local.tee $5
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  local.set $6
  local.get $5
  i32.wrap_i64
  local.tee $4
  local.get $6
  i32.const 1072693248
  i32.sub
  i32.or
  i32.eqz
  if
   local.get $0
   call $~lib/math/NativeMath.atan
   return
  end
  local.get $6
  i32.const 30
  i32.shr_u
  i32.const 2
  i32.and
  local.get $7
  i32.const 31
  i32.shr_u
  i32.or
  local.set $2
  local.get $7
  i32.const 2147483647
  i32.and
  local.tee $7
  local.get $3
  i32.wrap_i64
  i32.or
  i32.eqz
  if
   block $break|0
    block $case3|0
     block $case2|0
      block $case0|0
       local.get $2
       br_table $case0|0 $case0|0 $case2|0 $case3|0 $break|0
      end
      local.get $0
      return
     end
     f64.const 3.141592653589793
     return
    end
    f64.const -3.141592653589793
    return
   end
  end
  block $folding-inner0
   local.get $6
   i32.const 2147483647
   i32.and
   local.tee $6
   local.get $4
   i32.or
   i32.eqz
   br_if $folding-inner0
   local.get $6
   i32.const 2146435072
   i32.eq
   if
    local.get $7
    i32.const 2146435072
    i32.eq
    if (result f64)
     f64.const 2.356194490192345
     f64.const 0.7853981633974483
     local.get $2
     i32.const 2
     i32.and
     select
     local.tee $0
     f64.neg
     local.get $0
     local.get $2
     i32.const 1
     i32.and
     select
    else
     f64.const 3.141592653589793
     f64.const 0
     local.get $2
     i32.const 2
     i32.and
     select
     local.tee $0
     f64.neg
     local.get $0
     local.get $2
     i32.const 1
     i32.and
     select
    end
    return
   end
   local.get $7
   i32.const 2146435072
   i32.eq
   local.get $6
   i32.const 67108864
   i32.add
   local.get $7
   i32.lt_u
   i32.or
   br_if $folding-inner0
   local.get $7
   i32.const 67108864
   i32.add
   local.get $6
   i32.lt_u
   i32.const 0
   local.get $2
   i32.const 2
   i32.and
   select
   if (result f64)
    f64.const 0
   else
    local.get $0
    local.get $1
    f64.div
    f64.abs
    call $~lib/math/NativeMath.atan
   end
   local.set $0
   block $break|1
    block $case3|1
     block $case2|1
      block $case1|1
       block $case0|1
        local.get $2
        br_table $case0|1 $case1|1 $case2|1 $case3|1 $break|1
       end
       local.get $0
       return
      end
      local.get $0
      f64.neg
      return
     end
     f64.const 3.141592653589793
     local.get $0
     f64.const -1.2246467991473532e-16
     f64.add
     f64.sub
     return
    end
    local.get $0
    f64.const -1.2246467991473532e-16
    f64.add
    f64.const -3.141592653589793
    f64.add
    return
   end
   unreachable
  end
  f64.const -1.5707963267948966
  f64.const 1.5707963267948966
  local.get $2
  i32.const 1
  i32.and
  select
 )
 (func $~lib/math/pio2_large_quot (param $0 i64) (result i32)
  (local $1 i64)
  (local $2 i64)
  (local $3 i64)
  (local $4 i32)
  (local $5 f64)
  (local $6 i64)
  (local $7 i64)
  (local $8 i64)
  (local $9 i64)
  (local $10 i64)
  (local $11 i64)
  (local $12 i64)
  local.get $0
  i64.const 9223372036854775807
  i64.and
  i64.const 52
  i64.shr_u
  i64.const 1045
  i64.sub
  local.tee $1
  i64.const 63
  i64.and
  local.set $6
  local.get $1
  i64.const 6
  i64.shr_s
  i32.wrap_i64
  i32.const 3
  i32.shl
  i32.const 1024
  i32.add
  local.tee $4
  i64.load
  local.set $3
  local.get $4
  i64.load offset=8
  local.set $2
  local.get $4
  i64.load offset=16
  local.set $1
  local.get $6
  i64.const 0
  i64.ne
  if
   local.get $3
   local.get $6
   i64.shl
   local.get $2
   i64.const 64
   local.get $6
   i64.sub
   local.tee $7
   i64.shr_u
   i64.or
   local.set $3
   local.get $2
   local.get $6
   i64.shl
   local.get $1
   local.get $7
   i64.shr_u
   i64.or
   local.set $2
   local.get $1
   local.get $6
   i64.shl
   local.get $4
   i64.load offset=24
   local.get $7
   i64.shr_u
   i64.or
   local.set $1
  end
  local.get $0
  i64.const 4503599627370495
  i64.and
  i64.const 4503599627370496
  i64.or
  local.tee $6
  i64.const 4294967295
  i64.and
  local.set $7
  local.get $2
  i64.const 4294967295
  i64.and
  local.tee $8
  local.get $6
  i64.const 32
  i64.shr_u
  local.tee $9
  i64.mul
  local.get $2
  i64.const 32
  i64.shr_u
  local.tee $2
  local.get $7
  i64.mul
  local.get $7
  local.get $8
  i64.mul
  local.tee $7
  i64.const 32
  i64.shr_u
  i64.add
  local.tee $8
  i64.const 4294967295
  i64.and
  i64.add
  local.set $10
  local.get $2
  local.get $9
  i64.mul
  local.get $8
  i64.const 32
  i64.shr_u
  i64.add
  local.get $10
  i64.const 32
  i64.shr_u
  i64.add
  global.set $~lib/math/res128_hi
  local.get $9
  local.get $1
  i64.const 32
  i64.shr_u
  i64.mul
  local.tee $1
  local.get $7
  i64.const 4294967295
  i64.and
  local.get $10
  i64.const 32
  i64.shl
  i64.add
  i64.add
  local.tee $2
  local.get $1
  i64.lt_u
  i64.extend_i32_u
  global.get $~lib/math/res128_hi
  local.get $3
  local.get $6
  i64.mul
  i64.add
  i64.add
  local.tee $3
  i64.const 2
  i64.shl
  local.get $2
  i64.const 62
  i64.shr_u
  i64.or
  local.tee $6
  i64.const 63
  i64.shr_s
  local.tee $7
  local.get $2
  i64.const 2
  i64.shl
  i64.xor
  local.set $2
  local.get $6
  local.get $7
  i64.const 1
  i64.shr_s
  i64.xor
  local.tee $1
  i64.clz
  local.set $8
  local.get $1
  local.get $8
  i64.shl
  local.get $2
  i64.const 64
  local.get $8
  i64.sub
  i64.shr_u
  i64.or
  local.tee $9
  i64.const 4294967295
  i64.and
  local.set $1
  local.get $9
  i64.const 32
  i64.shr_u
  local.tee $10
  i64.const 560513588
  i64.mul
  local.get $1
  i64.const 3373259426
  i64.mul
  local.get $1
  i64.const 560513588
  i64.mul
  local.tee $11
  i64.const 32
  i64.shr_u
  i64.add
  local.tee $12
  i64.const 4294967295
  i64.and
  i64.add
  local.set $1
  local.get $10
  i64.const 3373259426
  i64.mul
  local.get $12
  i64.const 32
  i64.shr_u
  i64.add
  local.get $1
  i64.const 32
  i64.shr_u
  i64.add
  global.set $~lib/math/res128_hi
  local.get $9
  f64.convert_i64_u
  f64.const 3.753184150245214e-04
  f64.mul
  local.get $2
  local.get $8
  i64.shl
  f64.convert_i64_u
  f64.const 3.834951969714103e-04
  f64.mul
  f64.add
  i64.trunc_sat_f64_u
  local.tee $2
  local.get $11
  i64.const 4294967295
  i64.and
  local.get $1
  i64.const 32
  i64.shl
  i64.add
  local.tee $1
  i64.gt_u
  i64.extend_i32_u
  global.get $~lib/math/res128_hi
  local.tee $9
  i64.const 11
  i64.shr_u
  i64.add
  f64.convert_i64_u
  global.set $~lib/math/rempio2_y0
  local.get $9
  i64.const 53
  i64.shl
  local.get $1
  i64.const 11
  i64.shr_u
  i64.or
  local.get $2
  i64.add
  f64.convert_i64_u
  f64.const 5.421010862427522e-20
  f64.mul
  global.set $~lib/math/rempio2_y1
  global.get $~lib/math/rempio2_y0
  i64.const 4372995238176751616
  local.get $8
  i64.const 52
  i64.shl
  i64.sub
  local.get $0
  local.get $6
  i64.xor
  i64.const -9223372036854775808
  i64.and
  i64.or
  f64.reinterpret_i64
  local.tee $5
  f64.mul
  global.set $~lib/math/rempio2_y0
  global.get $~lib/math/rempio2_y1
  local.get $5
  f64.mul
  global.set $~lib/math/rempio2_y1
  local.get $3
  i64.const 62
  i64.shr_s
  local.get $7
  i64.sub
  i32.wrap_i64
 )
 (func $~lib/math/NativeMath.atan (param $0 f64) (result f64)
  (local $1 f64)
  (local $2 i32)
  (local $3 i32)
  (local $4 f64)
  (local $5 f64)
  local.get $0
  local.set $1
  local.get $0
  i64.reinterpret_f64
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  i32.const 2147483647
  i32.and
  local.tee $2
  i32.const 1141899264
  i32.ge_u
  if
   local.get $0
   local.get $0
   f64.ne
   if
    local.get $0
    return
   end
   f64.const 1.5707963267948966
   local.get $1
   f64.copysign
   return
  end
  local.get $2
  i32.const 1071382528
  i32.lt_u
  if
   local.get $2
   i32.const 1044381696
   i32.lt_u
   if
    local.get $0
    return
   end
   i32.const -1
   local.set $3
  else
   local.get $0
   f64.abs
   local.set $0
   local.get $2
   i32.const 1072889856
   i32.lt_u
   if (result f64)
    local.get $2
    i32.const 1072037888
    i32.lt_u
    if (result f64)
     local.get $0
     local.get $0
     f64.add
     f64.const -1
     f64.add
     local.get $0
     f64.const 2
     f64.add
     f64.div
    else
     i32.const 1
     local.set $3
     local.get $0
     f64.const -1
     f64.add
     local.get $0
     f64.const 1
     f64.add
     f64.div
    end
   else
    local.get $2
    i32.const 1073971200
    i32.lt_u
    if (result f64)
     i32.const 2
     local.set $3
     local.get $0
     f64.const -1.5
     f64.add
     local.get $0
     f64.const 1.5
     f64.mul
     f64.const 1
     f64.add
     f64.div
    else
     i32.const 3
     local.set $3
     f64.const -1
     local.get $0
     f64.div
    end
   end
   local.set $0
  end
  local.get $0
  local.get $0
  f64.mul
  local.tee $5
  local.get $5
  f64.mul
  local.set $4
  local.get $0
  local.get $5
  local.get $4
  local.get $4
  local.get $4
  local.get $4
  local.get $4
  f64.const 0.016285820115365782
  f64.mul
  f64.const 0.049768779946159324
  f64.add
  f64.mul
  f64.const 0.06661073137387531
  f64.add
  f64.mul
  f64.const 0.09090887133436507
  f64.add
  f64.mul
  f64.const 0.14285714272503466
  f64.add
  f64.mul
  f64.const 0.3333333333333293
  f64.add
  f64.mul
  local.get $4
  local.get $4
  local.get $4
  local.get $4
  local.get $4
  f64.const -0.036531572744216916
  f64.mul
  f64.const -0.058335701337905735
  f64.add
  f64.mul
  f64.const -0.0769187620504483
  f64.add
  f64.mul
  f64.const -0.11111110405462356
  f64.add
  f64.mul
  f64.const -0.19999999999876483
  f64.add
  f64.mul
  f64.add
  f64.mul
  local.set $4
  local.get $3
  i32.const 0
  i32.lt_s
  if
   local.get $0
   local.get $4
   f64.sub
   return
  end
  block $break|0 (result f64)
   block $case3|0
    block $case2|0
     block $case1|0
      block $case0|0
       block $tablify|0
        local.get $3
        br_table $case0|0 $case1|0 $case2|0 $case3|0 $tablify|0
       end
       unreachable
      end
      f64.const 0.4636476090008061
      local.get $4
      f64.const -2.2698777452961687e-17
      f64.add
      local.get $0
      f64.sub
      f64.sub
      br $break|0
     end
     f64.const 0.7853981633974483
     local.get $4
     f64.const -3.061616997868383e-17
     f64.add
     local.get $0
     f64.sub
     f64.sub
     br $break|0
    end
    f64.const 0.982793723247329
    local.get $4
    f64.const -1.3903311031230998e-17
    f64.add
    local.get $0
    f64.sub
    f64.sub
    br $break|0
   end
   f64.const 1.5707963267948966
   local.get $4
   f64.const -6.123233995736766e-17
   f64.add
   local.get $0
   f64.sub
   f64.sub
  end
  local.get $1
  f64.copysign
 )
 (func $src/simulation/wasm/chladni.as/evalBaseWave (param $0 f32) (param $1 f32) (param $2 f32) (param $3 f32) (param $4 f32) (param $5 f32) (param $6 f32) (result f32)
  (local $7 i32)
  (local $8 f64)
  (local $9 f64)
  (local $10 f32)
  local.get $4
  f32.const 30
  f32.div
  f32.const 1.5707963705062866
  f32.mul
  local.set $4
  local.get $6
  f64.promote_f32
  local.tee $9
  f64.ceil
  local.tee $8
  local.get $8
  f64.const -1
  f64.add
  local.get $8
  f64.const -0.5
  f64.add
  local.get $9
  f64.le
  select
  i32.trunc_sat_f64_s
  local.tee $7
  i32.const 1
  i32.eq
  if (result f32)
   local.get $1
   f64.promote_f32
   local.get $0
   f64.promote_f32
   call $~lib/math/NativeMath.atan2
   f32.demote_f64
   local.set $6
   local.get $2
   local.get $4
   f32.mul
   local.get $0
   local.get $0
   f32.mul
   local.get $1
   local.get $1
   f32.mul
   f32.add
   f64.promote_f32
   f64.sqrt
   f32.demote_f64
   local.tee $0
   f32.mul
   f32.const 1.5
   f32.mul
   f64.promote_f32
   call $~lib/math/NativeMath.cos
   f32.demote_f64
   local.get $5
   local.get $3
   local.get $6
   f32.mul
   f64.promote_f32
   call $~lib/math/NativeMath.cos
   f32.demote_f64
   f32.mul
   local.get $4
   local.get $0
   f32.mul
   f32.const 1.5
   f32.mul
   f64.promote_f32
   call $~lib/math/NativeMath.sin
   f32.demote_f64
   f32.mul
   f32.sub
  else
   local.get $7
   i32.const 2
   i32.eq
   if (result f32)
    local.get $1
    f64.promote_f32
    local.get $0
    f64.promote_f32
    call $~lib/math/NativeMath.atan2
    f32.demote_f64
    local.set $6
    local.get $2
    local.get $4
    f32.mul
    local.get $0
    local.get $0
    f32.mul
    local.get $1
    local.get $1
    f32.mul
    f32.add
    f64.promote_f32
    f64.sqrt
    f32.demote_f64
    local.tee $0
    f32.mul
    f32.const 1.7999999523162842
    f32.mul
    f64.promote_f32
    call $~lib/math/NativeMath.cos
    f32.demote_f64
    local.get $3
    local.get $6
    f32.mul
    f64.promote_f32
    call $~lib/math/NativeMath.cos
    f32.demote_f64
    f32.mul
    local.get $5
    local.get $4
    local.get $0
    f32.mul
    f32.const 2
    f32.mul
    f64.promote_f32
    call $~lib/math/NativeMath.sin
    f32.demote_f64
    f32.mul
    f32.sub
   else
    local.get $7
    i32.const 3
    i32.eq
    if (result f32)
     local.get $4
     local.get $2
     f32.const 0.4000000059604645
     f32.mul
     f32.mul
     local.tee $6
     local.get $0
     f32.mul
     f64.promote_f32
     call $~lib/math/NativeMath.cos
     f32.demote_f64
     local.get $6
     local.get $0
     f32.const -0.5
     f32.mul
     local.tee $2
     local.get $1
     f32.const 0.8660253882408142
     f32.mul
     local.tee $10
     f32.add
     f32.mul
     f64.promote_f32
     call $~lib/math/NativeMath.cos
     f32.demote_f64
     f32.add
     local.get $6
     local.get $2
     local.get $10
     f32.sub
     f32.mul
     f64.promote_f32
     call $~lib/math/NativeMath.cos
     f32.demote_f64
     f32.add
     f32.const 0.666670024394989
     f32.mul
     local.get $5
     local.get $3
     local.get $4
     f32.mul
     local.get $0
     local.get $0
     f32.mul
     local.get $1
     local.get $1
     f32.mul
     f32.add
     f64.promote_f32
     f64.sqrt
     f32.demote_f64
     f32.mul
     f64.promote_f32
     call $~lib/math/NativeMath.cos
     f32.demote_f64
     f32.mul
     f32.sub
    else
     local.get $7
     i32.const 4
     i32.eq
     if (result f32)
      local.get $2
      local.get $4
      local.get $0
      local.get $1
      f32.add
      f32.mul
      f32.const 0.7071067690849304
      f32.mul
      local.tee $6
      f32.mul
      f64.promote_f32
      call $~lib/math/NativeMath.cos
      f32.demote_f64
      local.get $3
      local.get $4
      local.get $0
      local.get $1
      f32.sub
      f32.mul
      f32.const 0.7071067690849304
      f32.mul
      local.tee $0
      f32.mul
      f64.promote_f32
      call $~lib/math/NativeMath.cos
      f32.demote_f64
      f32.mul
      local.get $5
      local.get $3
      local.get $6
      f32.mul
      f64.promote_f32
      call $~lib/math/NativeMath.cos
      f32.demote_f64
      f32.mul
      local.get $2
      local.get $0
      f32.mul
      f64.promote_f32
      call $~lib/math/NativeMath.cos
      f32.demote_f64
      f32.mul
      f32.sub
     else
      local.get $7
      i32.const 5
      i32.eq
      if (result f32)
       local.get $1
       f64.promote_f32
       local.get $0
       f64.promote_f32
       call $~lib/math/NativeMath.atan2
       f32.demote_f64
       local.set $6
       local.get $2
       local.get $4
       f32.mul
       local.get $0
       local.get $0
       f32.mul
       local.get $1
       local.get $1
       f32.mul
       f32.add
       f64.promote_f32
       f64.sqrt
       f32.demote_f64
       local.tee $0
       f32.mul
       f32.const 1.399999976158142
       f32.mul
       f64.promote_f32
       call $~lib/math/NativeMath.sin
       f32.demote_f64
       local.get $3
       local.get $6
       f32.mul
       f64.promote_f32
       call $~lib/math/NativeMath.cos
       f32.demote_f64
       f32.mul
       local.get $5
       local.get $4
       local.get $0
       f32.mul
       f32.const 3
       f32.mul
       f64.promote_f32
       call $~lib/math/NativeMath.cos
       f32.demote_f64
       f32.mul
       f32.sub
      else
       local.get $2
       local.get $4
       local.get $0
       f32.mul
       local.tee $0
       f32.mul
       f64.promote_f32
       call $~lib/math/NativeMath.cos
       f32.demote_f64
       local.get $3
       local.get $4
       local.get $1
       f32.mul
       local.tee $1
       f32.mul
       f64.promote_f32
       call $~lib/math/NativeMath.cos
       f32.demote_f64
       f32.mul
       local.get $5
       local.get $3
       local.get $0
       f32.mul
       f64.promote_f32
       call $~lib/math/NativeMath.cos
       f32.demote_f64
       f32.mul
       local.get $2
       local.get $1
       f32.mul
       f64.promote_f32
       call $~lib/math/NativeMath.cos
       f32.demote_f64
       f32.mul
       f32.sub
      end
     end
    end
   end
  end
 )
 (func $~start
  i32.const 1388
  global.set $~lib/rt/stub/offset
 )
 (func $~lib/rt/stub/__unpin (param $0 i32)
 )
 (func $~lib/rt/stub/__pin (param $0 i32) (result i32)
  local.get $0
 )
 (func $~lib/rt/stub/__new (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  local.get $0
  i32.const 1073741804
  i32.gt_u
  if
   i32.const 1248
   i32.const 1312
   i32.const 86
   i32.const 30
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 16
  i32.add
  local.tee $3
  i32.const 1073741820
  i32.gt_u
  if
   i32.const 1248
   i32.const 1312
   i32.const 33
   i32.const 29
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/rt/stub/offset
  i32.const 4
  i32.add
  local.tee $2
  local.get $3
  i32.const 19
  i32.add
  i32.const -16
  i32.and
  i32.const 4
  i32.sub
  local.tee $3
  i32.add
  local.tee $4
  memory.size
  local.tee $5
  i32.const 16
  i32.shl
  i32.const 15
  i32.add
  i32.const -16
  i32.and
  local.tee $6
  i32.gt_u
  if
   local.get $5
   local.get $4
   local.get $6
   i32.sub
   i32.const 65535
   i32.add
   i32.const -65536
   i32.and
   i32.const 16
   i32.shr_u
   local.tee $6
   local.get $5
   local.get $6
   i32.gt_s
   select
   memory.grow
   i32.const 0
   i32.lt_s
   if
    local.get $6
    memory.grow
    i32.const 0
    i32.lt_s
    if
     unreachable
    end
   end
  end
  global.get $~lib/rt/stub/offset
  local.get $4
  global.set $~lib/rt/stub/offset
  local.get $3
  i32.store
  local.get $2
  i32.const 4
  i32.sub
  local.tee $3
  i32.const 0
  i32.store offset=4
  local.get $3
  i32.const 0
  i32.store offset=8
  local.get $3
  local.get $1
  i32.store offset=12
  local.get $3
  local.get $0
  i32.store offset=16
  local.get $2
  i32.const 16
  i32.add
 )
 (func $~lib/rt/stub/__collect
 )
 (func $src/simulation/wasm/chladni.as/stepParticlesWasm (param $0 i32) (param $1 i32) (param $2 f32) (param $3 f32) (param $4 f32) (param $5 f32) (param $6 f32) (param $7 f32) (param $8 f32) (param $9 f32) (param $10 f32) (param $11 f32) (result i32)
  (local $12 f32)
  (local $13 f32)
  (local $14 i32)
  (local $15 f32)
  (local $16 i32)
  (local $17 i32)
  (local $18 f32)
  (local $19 f32)
  (local $20 f32)
  (local $21 f32)
  (local $22 f32)
  loop $for-loop|0
   local.get $1
   local.get $16
   i32.gt_s
   if
    local.get $7
    local.get $0
    local.get $16
    i32.const 4
    i32.shl
    i32.add
    local.tee $14
    f32.load
    local.tee $19
    local.get $14
    f32.load offset=4
    local.tee $13
    local.get $3
    local.get $4
    local.get $5
    local.get $6
    local.get $8
    local.get $9
    local.get $10
    local.get $11
    call $src/simulation/wasm/chladni.as/evalChladniW
    local.tee $12
    f64.promote_f32
    f64.abs
    f32.demote_f64
    f32.mul
    local.set $20
    local.get $19
    f64.promote_f32
    f64.abs
    f32.demote_f64
    local.set $15
    local.get $13
    f64.promote_f32
    f64.abs
    f32.demote_f64
    local.set $18
    local.get $10
    f32.const 0.5
    f32.gt
    if (result f64)
     local.get $15
     f64.promote_f32
     local.get $18
     f64.promote_f32
     f64.max
    else
     local.get $19
     local.get $19
     f32.mul
     local.get $13
     local.get $13
     f32.mul
     f32.add
     f64.promote_f32
     f64.sqrt
    end
    f32.demote_f64
    local.set $18
    local.get $20
    f32.const 1
    f32.gt
    if
     f32.const -1
     f32.const 1
     local.get $12
     f32.const 0
     f32.ge
     select
     local.tee $12
     local.get $19
     local.get $13
     local.get $3
     local.get $4
     local.get $5
     local.get $6
     local.get $8
     local.get $9
     local.get $10
     local.get $11
     call $src/simulation/wasm/chladni.as/evalChladniGradX
     f32.mul
     local.get $7
     f32.const 2.2000000171829015e-04
     f32.mul
     local.tee $21
     f32.mul
     local.set $15
     local.get $12
     local.get $19
     local.get $13
     local.get $3
     local.get $4
     local.get $5
     local.get $6
     local.get $8
     local.get $9
     local.get $10
     local.get $11
     call $src/simulation/wasm/chladni.as/evalChladniGradY
     f32.mul
     local.get $21
     f32.mul
     local.set $12
     local.get $9
     local.get $18
     f32.gt
     local.get $9
     f32.const 0.009999999776482582
     f32.gt
     i32.and
     if
      local.get $15
      local.get $19
      f32.const 1
      local.get $18
      f32.div
      f32.const 0
      local.get $18
      f32.const 1.0000000474974513e-03
      f32.gt
      select
      local.tee $21
      f32.mul
      f32.const 1
      local.get $18
      local.get $9
      f32.div
      f32.sub
      local.get $11
      f32.const 1
      f32.add
      f32.const 3.5000001080334187e-03
      f32.mul
      f32.mul
      local.tee $18
      f32.mul
      f32.add
      local.set $15
      local.get $12
      local.get $13
      local.get $21
      f32.mul
      local.get $18
      f32.mul
      f32.add
      local.set $12
     end
     local.get $19
     f32.const 67.30000305175781
     f32.mul
     local.get $2
     f32.const 13.100000381469727
     f32.mul
     f32.add
     f32.const 12.989800453186035
     f32.mul
     local.get $13
     f32.const 31.700000762939453
     f32.mul
     f32.const 78.23300170898438
     f32.mul
     f32.add
     f64.promote_f32
     call $~lib/math/NativeMath.sin
     f32.demote_f64
     f32.const 43758.546875
     f32.mul
     local.set $21
     local.get $13
     f32.const 43.099998474121094
     f32.mul
     local.get $2
     f32.const 27.5
     f32.mul
     f32.add
     f32.const 12.989800453186035
     f32.mul
     local.get $19
     f32.const 89.19999694824219
     f32.mul
     f32.const 78.23300170898438
     f32.mul
     f32.add
     f64.promote_f32
     call $~lib/math/NativeMath.sin
     f32.demote_f64
     f32.const 43758.546875
     f32.mul
     local.set $18
     local.get $2
     f32.const 48
     f32.mul
     local.get $16
     f32.convert_i32_s
     f32.const 0.10000000149011612
     f32.mul
     f32.add
     f64.promote_f32
     call $~lib/math/NativeMath.sin
     f32.demote_f64
     f32.const 0.5
     f32.mul
     f32.const 0.5
     f32.add
     local.get $20
     f32.const -1
     f32.add
     f64.promote_f32
     f64.sqrt
     f32.demote_f64
     local.tee $20
     f32.mul
     f32.const 0.03200000151991844
     f32.mul
     local.set $22
     local.get $14
     local.get $19
     local.get $15
     local.get $21
     local.get $21
     f64.promote_f32
     f64.floor
     f32.demote_f64
     f32.sub
     f32.const -0.5
     f32.add
     local.get $20
     f32.const 0.00419999985024333
     f32.mul
     local.tee $15
     f32.mul
     f32.add
     f32.add
     f64.promote_f32
     f64.const 0.9700000286102295
     f64.min
     f64.const -0.9700000286102295
     f64.max
     f32.demote_f64
     f32.store
     local.get $14
     local.get $13
     local.get $12
     local.get $18
     local.get $18
     f64.promote_f32
     f64.floor
     f32.demote_f64
     f32.sub
     f32.const -0.5
     f32.add
     local.get $15
     f32.mul
     f32.add
     f32.add
     f64.promote_f32
     f64.const 0.9700000286102295
     f64.min
     f64.const -0.9700000286102295
     f64.max
     f32.demote_f64
     f32.store offset=4
     local.get $14
     local.get $22
     f32.store offset=8
     local.get $14
     f32.const 1
     f32.store offset=12
    else
     local.get $9
     local.get $18
     f32.gt
     local.get $9
     f32.const 0.009999999776482582
     f32.gt
     i32.and
     if
      local.get $14
      local.get $19
      local.get $19
      f32.const 1
      local.get $18
      f32.div
      f32.const 0
      local.get $18
      f32.const 1.0000000474974513e-03
      f32.gt
      select
      local.tee $12
      f32.mul
      f32.const 0.004000000189989805
      f32.mul
      f32.add
      f64.promote_f32
      f64.const 0.9700000286102295
      f64.min
      f64.const -0.9700000286102295
      f64.max
      f32.demote_f64
      f32.store
      local.get $14
      local.get $13
      local.get $13
      local.get $12
      f32.mul
      f32.const 0.004000000189989805
      f32.mul
      f32.add
      f64.promote_f32
      f64.const 0.9700000286102295
      f64.min
      f64.const -0.9700000286102295
      f64.max
      f32.demote_f64
      f32.store offset=4
      local.get $14
      f32.const 0.004000000189989805
      f32.store offset=8
      local.get $14
      f32.const 1
      f32.store offset=12
     else
      local.get $14
      local.get $20
      f32.const 0.8500000238418579
      f32.gt
      if (result f32)
       local.get $19
       f32.const -1
       f32.const 1
       local.get $12
       f32.const 0
       f32.ge
       select
       local.tee $12
       local.get $19
       local.get $13
       local.get $3
       local.get $4
       local.get $5
       local.get $6
       local.get $8
       local.get $9
       local.get $10
       local.get $11
       call $src/simulation/wasm/chladni.as/evalChladniGradX
       f32.mul
       f32.const 7.999999797903001e-05
       f32.mul
       f32.add
       local.get $13
       local.get $12
       local.get $19
       local.get $13
       local.get $3
       local.get $4
       local.get $5
       local.get $6
       local.get $8
       local.get $9
       local.get $10
       local.get $11
       call $src/simulation/wasm/chladni.as/evalChladniGradY
       f32.mul
       f32.const 7.999999797903001e-05
       f32.mul
       f32.add
       f64.promote_f32
       f64.const 0.9700000286102295
       f64.min
       f64.const -0.9700000286102295
       f64.max
       f32.demote_f64
       local.set $13
       f64.promote_f32
       f64.const 0.9700000286102295
       f64.min
       f64.const -0.9700000286102295
       f64.max
       f32.demote_f64
      else
       local.get $19
      end
      f32.store
      local.get $14
      local.get $13
      f32.store offset=4
      local.get $14
      f32.const 0
      f32.store offset=8
      local.get $14
      f32.const 0
      f32.store offset=12
      local.get $17
      i32.const 1
      i32.add
      local.set $17
     end
    end
    local.get $16
    i32.const 1
    i32.add
    local.set $16
    br $for-loop|0
   end
  end
  local.get $17
 )
 (func $src/simulation/wasm/chladni.as/computeActiveFractionWasm (param $0 i32) (param $1 f32) (param $2 f32) (param $3 f32) (param $4 f32) (param $5 f32) (param $6 f32) (param $7 f32) (param $8 f32) (param $9 f32) (result f32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  (local $13 f32)
  (local $14 i32)
  (local $15 f32)
  local.get $0
  local.get $0
  i32.mul
  local.set $14
  f32.const 2
  local.get $0
  f32.convert_i32_s
  f32.div
  local.set $13
  loop $for-loop|0
   local.get $0
   local.get $11
   i32.gt_s
   if
    local.get $11
    f32.convert_i32_s
    f32.const 0.5
    f32.add
    local.get $13
    f32.mul
    f32.const -1
    f32.add
    local.set $15
    i32.const 0
    local.set $10
    loop $for-loop|1
     local.get $0
     local.get $10
     i32.gt_s
     if
      local.get $12
      i32.const 1
      i32.add
      local.get $12
      local.get $5
      local.get $15
      local.get $10
      f32.convert_i32_s
      f32.const 0.5
      f32.add
      local.get $13
      f32.mul
      f32.const -1
      f32.add
      local.get $1
      local.get $2
      local.get $3
      local.get $4
      local.get $6
      local.get $7
      local.get $8
      local.get $9
      call $src/simulation/wasm/chladni.as/evalChladniW
      f64.promote_f32
      f64.abs
      f32.demote_f64
      f32.mul
      f32.const 1
      f32.gt
      select
      local.set $12
      local.get $10
      i32.const 1
      i32.add
      local.set $10
      br $for-loop|1
     end
    end
    local.get $11
    i32.const 1
    i32.add
    local.set $11
    br $for-loop|0
   end
  end
  local.get $12
  f32.convert_i32_s
  local.get $14
  f32.convert_i32_s
  f32.div
 )
 (func $src/simulation/wasm/chladni.as/benchmarkChladniBatch (param $0 i32) (param $1 f32) (param $2 f32) (param $3 f32) (param $4 f32) (param $5 f32) (param $6 f32) (param $7 f32) (param $8 f32) (result f32)
  (local $9 i32)
  (local $10 f32)
  (local $11 f32)
  (local $12 f32)
  (local $13 f32)
  f32.const 2
  local.get $0
  f32.convert_i32_s
  f32.div
  local.set $13
  loop $for-loop|0
   local.get $0
   local.get $9
   i32.gt_s
   if
    local.get $9
    f32.convert_i32_s
    local.get $13
    f32.mul
    f32.const -1
    f32.add
    local.tee $10
    f32.const 3.141590118408203
    f32.mul
    f64.promote_f32
    call $~lib/math/NativeMath.sin
    f32.demote_f64
    local.set $11
    local.get $12
    local.get $10
    local.get $11
    local.get $1
    local.get $2
    local.get $3
    local.get $4
    local.get $5
    local.get $6
    local.get $7
    local.get $8
    call $src/simulation/wasm/chladni.as/evalChladniW
    local.get $10
    local.get $11
    local.get $1
    local.get $2
    local.get $3
    local.get $4
    local.get $5
    local.get $6
    local.get $7
    local.get $8
    call $src/simulation/wasm/chladni.as/evalChladniGradX
    f32.const 0.10000000149011612
    f32.mul
    f32.add
    local.get $10
    local.get $11
    local.get $1
    local.get $2
    local.get $3
    local.get $4
    local.get $5
    local.get $6
    local.get $7
    local.get $8
    call $src/simulation/wasm/chladni.as/evalChladniGradY
    f32.const 0.10000000149011612
    f32.mul
    f32.add
    f32.add
    local.set $12
    local.get $9
    i32.const 1
    i32.add
    local.set $9
    br $for-loop|0
   end
  end
  local.get $12
 )
)
