// Centralised i18n dictionary. Format: key|繁體中文|English
const RAW = `
app.title|互動物理實驗室|Interactive Physics Laboratory
app.current|目前實驗|Current experiment
tab.experiments|實驗|Experiments
tab.objects|物件|Objects
tab.scene|場景|Scene
tab.experiment|實驗|Experiment
tab.properties|屬性|Properties
tab.data|數據|Data
tab.settings|設定|Settings
cat.mechanics|力學|Mechanics
cat.optics|光學|Optics
cat.waves|波動|Waves
cat.em|電磁|E&M
cat.thermo|熱學|Thermo
sec.mechPresets|力學實驗範例|Mechanics presets
sec.featured|精選範例|Featured presets
sec.experiments|實驗項目|Experiments
sec.library|物件庫|Object library
sec.edit|編輯|Edit
sec.connect|連接與約束|Joints & constraints
sec.hierarchy|場景階層|Scene hierarchy
sec.joints|連接|Joints
sec.modelNote|模型說明與限制|Model notes & limits
sec.transform|變換|Transform
sec.physics|物理屬性|Physical properties
sec.material|材質|Material
sec.liveObject|即時物件數據|Live object data
sec.theoryMeas|理論值 vs 量測值|Theory vs measured
sec.readouts|即時讀數|Live readouts
sec.vectors|向量與軌跡|Vectors & trails
sec.tools|量測工具|Measurement tools
sec.stopwatch|碼錶|Stopwatch
sec.environment|環境|Environment
sec.editing|編輯與顯示|Editing & display
sec.lighting|燈光與品質|Lighting & quality
exp.sandbox|自由沙盒|Free sandbox
exp.sandboxDesc|自由建構你的實驗：從「物件」分頁加入物體，用變換工具移動、旋轉、縮放，再用「連接」建立鉸鏈、彈簧等機構，最後按下播放。|Build any experiment freely: add bodies from the Objects tab, move/rotate/scale them with the gizmo, link them with joints and springs, then press Play.
exp.hintUnits|單位預設為 SI：m、kg、s、N、J、W、K。|Units are SI by default: m, kg, s, N, J, W, K.
tip.sandbox|清空並建立新的沙盒場景|Start a fresh sandbox scene
tip.add|新增{name}|Add {name}
tip.assembly|預先組裝的機構（含連接）|Pre-assembled mechanism (with joints)
tip.duplicate|複製選取物件（Ctrl+D）|Duplicate selection (Ctrl+D)
tip.delete|刪除選取物件（Del）|Delete selection (Del)
tip.group|將選取物件群組（Ctrl+G）|Group selection (Ctrl+G)
tip.ungroup|取消群組（Ctrl+Shift+G）|Ungroup (Ctrl+Shift+G)
tip.lock|鎖定／解鎖：鎖定後無法移動或刪除|Lock/unlock: locked objects cannot be moved or deleted
tip.selectAll|全選（Ctrl+A）|Select all (Ctrl+A)
tip.align|對齊選取物件的邊界框|Align the bounding boxes of the selection
tip.static|靜態物體固定不動，但仍可參與碰撞|Static bodies never move but still collide
tip.ghost|僅視覺顯示，不參與碰撞（例如軸承裝飾）|Visual only, no collision (e.g. decorative axles)
tip.density|密度 = 質量 ÷ 體積；修改密度會改變質量|Density = mass ÷ volume; editing it changes the mass
tip.friction|庫侖摩擦係數；接觸時取兩表面係數的乘積（地面為 1）|Coulomb friction; contact value is the product of both surfaces (ground = 1)
tip.restitution|恢復係數；接觸時取兩表面係數的乘積（地面為 1）。0＝完全非彈性，1＝完全彈性|Restitution; contact value is the product of both surfaces (ground = 1). 0 = perfectly inelastic, 1 = perfectly elastic
tip.gravityScale|重力影響倍率：1＝正常，0＝不受重力，負值＝反重力|Gravity influence: 1 = normal, 0 = weightless, negative = anti-gravity
tip.opacity|透明度：數值越低越透明|Opacity: lower = more transparent
tip.vecScale|向量長度 ∝ 量值 × 倍率（非等比例，僅表示方向與相對大小）|Arrow length ∝ magnitude × scale (indicates direction & relative size)
tip.stopwatch|碼錶依模擬時間計時，暫停模擬時也會暫停|The stopwatch follows simulation time and pauses with the simulation
tip.air|啟用空氣阻力：F = ½ρC_dAv²（教學用近似）|Enable air drag: F = ½ρC_dAv² (educational approximation)
tip.snap|格點吸附（G）|Grid snapping (G)
tip.adaptive|畫面過慢時自動降低解析度|Automatically lower resolution when frames get slow
tip.leftPanel|顯示／隱藏左側面板|Toggle left panel
tip.rightPanel|顯示／隱藏右側面板|Toggle right panel
tip.save|儲存場景到瀏覽器|Save scene to this browser
tip.load|開啟場景管理|Open scene manager
tip.theme|切換深色／淺色主題|Toggle dark / light theme
tip.bottom|收合／展開下方面板|Collapse / expand bottom panel
tip.timeline|拖曳時間軸可回溯到先前的模擬快照|Drag to rewind to earlier simulation snapshots
tip.chartPause|凍結圖表更新|Freeze chart updates
tip.chartClear|清除圖表資料|Clear chart data
tip.csv|將目前圖表資料匯出為 CSV|Export current chart data as CSV
tip.persp|透視相機|Perspective camera
tip.ortho|正交相機|Orthographic camera
act.undo|復原|Undo
act.redo|重做|Redo
act.save|儲存|Save
act.load|載入|Load
act.play|播放|Play
act.pause|暫停|Pause
act.step|單步|Step
act.reset|重設|Reset
act.clear|清除|Clear
act.clearScene|清空場景|Clear scene
act.delete|刪除|Delete
act.duplicate|複製|Duplicate
act.group|群組|Group
act.ungroup|取消群組|Ungroup
act.lock|鎖定|Lock
act.unlock|解除鎖定|Unlock
act.selectAll|全選|Select all
act.align|對齊|Align
act.rename|重新命名|Rename
act.exportJson|匯出 JSON|Export JSON
act.importJson|匯入 JSON|Import JSON
act.exportCsv|匯出 CSV|Export CSV
act.share|分享連結|Share link
act.start|開始|Start
act.stop|停止|Stop
act.reload|重新載入|Reload
act.pauseChart|暫停圖表|Pause chart
act.resumeChart|繼續圖表|Resume chart
align.min|最小|Min
align.center|中心|Center
align.max|最大|Max
obj.cube|立方體|Cube
obj.sphere|球體|Sphere
obj.cylinder|圓柱|Cylinder
obj.cone|圓錐|Cone
obj.capsule|膠囊|Capsule
obj.plane|平板|Plane
obj.pyramid|角錐|Pyramid
obj.wall|牆|Wall
obj.platform|平台|Platform
obj.ramp|斜坡|Ramp
obj.beam|橫梁|Beam
obj.rod|桿|Rod
obj.wheel|輪子|Wheel
obj.gear|齒輪|Gear
obj.container|容器|Container
obj.pulley|滑輪|Pulley
asm.spring|彈簧|Spring
asm.rope|繩索|Rope
asm.pendulum|單擺|Pendulum
asm.pulley|滑輪組|Pulley set
joint.fixed|固定接頭|Fixed joint
joint.revolute|旋轉接頭（鉸鏈）|Revolute joint (hinge)
joint.prismatic|滑動接頭|Prismatic joint
joint.spherical|球窩接頭|Ball joint
joint.spring|彈簧|Spring
joint.distance|距離約束（繩）|Distance constraint (rope)
joint.pulley|滑輪繩|Pulley rope
joint.gear|齒輪嚙合|Gear mesh
conn.hint|已選取 {n} 個物件：選 2 個＝連接兩者；選 1 個＝連接到世界（錨點＝物件中心＋偏移）。|{n} selected: pick 2 = connect them; pick 1 = connect to the world (anchor = object centre + offset).
conn.type|類型|Type
conn.axis|旋轉／滑動軸|Joint axis
conn.limit|啟用範圍限制|Enable limits
conn.lo|下限|Lower limit
conn.hi|上限|Upper limit
conn.k|彈性係數 k|Stiffness k
conn.c|阻尼 c|Damping c
conn.len|長度|Length
conn.offset|世界錨點偏移|World anchor offset
conn.create|建立連接|Create joint
conn.world|世界|World
props.none|請先在場景中選取物件。|Select an object in the scene first.
props.multi|已選取 {n} 個物件|{n} objects selected
props.name|名稱|Name
props.static|靜態|Static
props.locked|鎖定|Locked
props.ghost|無碰撞|No collision
props.position|位置|Position
props.rotation|旋轉|Rotation
props.scale|縮放（尺寸）|Scale (size)
props.mass|質量|Mass
props.density|密度|Density
props.friction|摩擦係數|Friction
props.restitution|恢復係數|Restitution
props.gravityScale|重力影響|Gravity influence
props.linDamp|線性阻尼|Linear damping
props.angDamp|角阻尼|Angular damping
props.lv|初始速度|Initial velocity
props.av|初始角速度|Initial angular velocity
props.force|持續外力|Applied force
props.torque|持續外力矩|Applied torque
props.color|顏色|Color
props.roughness|粗糙度|Roughness
props.metalness|金屬度|Metalness
props.opacity|不透明度|Opacity
props.emissive|自發光強度|Emissive intensity
mat.metal|金屬|Metal
mat.glass|玻璃|Glass
mat.plastic|塑膠|Plastic
mat.rubber|橡膠|Rubber
mat.wood|木材|Wood
mat.ceramic|陶瓷|Ceramic
mat.concrete|混凝土|Concrete
mat.water|水|Water
mat.emissive|發光體|Emissive
mat.copper|銅|Copper
mat.aluminium|鋁|Aluminium
mat.steel|鋼|Steel
mat.invar|殷鋼|Invar
mat.lead|鉛|Lead
data.fromSim|來自模擬狀態|from simulation state
m.pos|位置|Position
m.rot|旋轉|Rotation
m.vel|速度|Velocity
m.speed|速率|Speed
m.angvel|角速度|Angular velocity
m.acc|加速度|Acceleration
m.mass|質量|Mass
m.force|淨力 F = ma|Net force F = ma
m.mom|動量 p = mv|Momentum p = mv
m.angmom|角動量 L = Iω|Angular momentum L = Iω
m.ekT|平動動能 ½mv²|Translational KE ½mv²
m.ekR|轉動動能 ½Iω²|Rotational KE ½Iω²
m.ep|重力位能 mgh|Gravitational PE mgh
m.etot|總機械能|Total mechanical energy
m.sysEk|系統動能|System kinetic energy
m.sysEp|系統重力位能|System potential energy
m.sysEs|彈簧彈性位能|Spring elastic energy
m.sysE|系統總能量|System total energy
m.sysP|系統總動量大小|System momentum magnitude
m.dist2|兩物件中心距離|Distance between centres
vec.v|速度向量|Velocity vector
vec.a|加速度向量|Acceleration vector
vec.F|力向量（F=ma）|Force vector (F = ma)
vec.p|動量向量|Momentum vector
vec.g|重力向量（mg）|Gravity vector (mg)
vec.scale|向量長度倍率|Vector length scale
vec.trails|粒子軌跡|Particle trails
vec.note|向量顯示於選取的動態物件上。|Vectors are drawn on the selected dynamic objects.
tool.none|選取|Select
tool.ruler|尺規／距離量測|Ruler / distance
tool.protractor|量角器／角度量測|Protractor / angle
tool.inspect|座標檢查|Coordinate inspector
tool.none.hint|在視窗中點擊物件即可選取。|Click objects in the viewport to select them.
tool.ruler.hint|依序點擊兩點（已選 {n}/2）以量測距離。|Click two points ({n}/2) to measure a distance.
tool.protractor.hint|依序點擊三點：端點、頂點、端點（已選 {n}/3）。|Click three points: end, vertex, end ({n}/3).
tool.inspect.hint|將滑鼠移到場景表面以檢視世界座標。|Hover over the scene to read world coordinates.
tool.distance|距離|Distance
tool.delta|分量 (Δx, Δy, Δz)|Components (Δx, Δy, Δz)
tool.angle|角度|Angle
tool.coords|世界座標|World coordinates
env.earth|地球|Earth
env.moon|月球|Moon
env.mars|火星|Mars
env.zero|無重力|Zero gravity
env.custom|自訂|Custom
env.active|目前環境|Active environment
env.g|重力加速度 g|Gravity g
env.air|空氣阻力|Air resistance
env.rho|空氣密度 ρ|Air density ρ
set.snap|格點吸附|Grid snapping
set.snapShort|吸附|Snap
set.snapT|位移間距|Move step
set.snapR|旋轉間距|Rotate step
set.grid|顯示格線|Show grid
set.axes|顯示座標軸與刻度|Show axes & rulers
set.tempUnit|溫度顯示單位|Temperature unit
set.shadows|陰影品質|Shadow quality
set.adaptive|自適應畫質|Adaptive quality
light.ambient|環境光|Ambient light
light.sun|平行光（太陽）|Directional light (sun)
light.point|點光源|Point light
light.spot|聚光燈|Spotlight
q.off|關|Off
q.low|低|Low
q.med|中|Medium
q.high|高|High
cam.persp|透視|Persp
cam.ortho|正交|Ortho
cam.reset|重設視角|Reset view
cam.focus|聚焦選取物件|Focus selection
gizmo.select|選取|Select
gizmo.translate|移動|Move
gizmo.rotate|旋轉|Rotate
gizmo.scale|縮放|Scale
ctl.speed|速度|Speed
ctl.running|執行中|Running
ctl.paused|已暫停|Paused
ctl.timeline|時間軸|Timeline
ctx.makeStatic|設為靜態|Make static
ctx.makeDynamic|設為動態|Make dynamic
menu.scenes|場景管理|Scenes
menu.help|說明與快捷鍵|Help & shortcuts
menu.language|語言|Language
scene.untitled|未命名場景|Untitled scene
scene.name|場景名稱|Scene name
scene.empty|尚未儲存任何場景。|No saved scenes yet.
scene.objects|個物件|objects
scene.copySuffix| 副本| copy
help.intro|這是即時 3D 物理實驗室：力學使用 Rapier 剛體引擎（固定時間步長 1/240 s），光學、波動、電磁與熱學使用各自的數學模型。|A real-time 3D physics lab: mechanics runs on the Rapier rigid-body engine (fixed 1/240 s timestep); optics, waves, E&M and thermodynamics use dedicated mathematical models.
help.mouse|滑鼠：左鍵選取／拖曳工具；右鍵拖曳平移；滾輪縮放；左鍵拖曳空白處旋轉；右鍵點擊物件開啟選單。|Mouse: left-click selects; left-drag orbits; right-drag pans; wheel zooms; right-click an object for its menu.
help.honesty|所有顯示的量測值皆由模擬狀態計算；簡化模型會在「模型說明與限制」中標示。|All measurements are derived from the simulation state; simplified models are flagged under “Model notes & limits”.
key.play|播放／暫停|Play / pause
key.step|單步前進（1/60 s）|Single step (1/60 s)
key.reset|重設模擬|Reset simulation
key.gizmo|選取／移動／旋轉／縮放|Select / move / rotate / scale
key.delete|刪除|Delete
key.undo|復原／重做|Undo / redo
key.duplicate|複製|Duplicate
key.group|群組／取消群組|Group / ungroup
key.selectAll|全選|Select all
key.save|快速儲存|Quick save
key.focus|聚焦選取物件|Focus selection
key.camera|重設相機|Reset camera
key.snap|切換格點吸附|Toggle snapping
key.multi|多重選取|Multi-select
key.deselect|取消選取／關閉視窗|Deselect / close dialog
key.help|顯示說明|Show help
msg.added|已新增物件|Object added
msg.cleared|場景已清空|Scene cleared
msg.duplicated|已複製物件|Duplicated
msg.emptyScene|場景中沒有物件|No objects in the scene
msg.emptyViewport|從左側「物件」分頁新增物件，或到「實驗」分頁載入範例。|Add objects from the Objects tab, or load a preset from the Experiments tab.
msg.grouped|已群組|Grouped
msg.ungrouped|已取消群組|Ungrouped
msg.imported|已匯入場景|Scene imported
msg.jointAdded|已建立連接|Joint created
msg.linkCopied|分享連結已複製到剪貼簿|Share link copied to clipboard
msg.loaded|已載入「{name}」|Loaded “{name}”
msg.loading|載入中…|Loading…
msg.locked|物件已鎖定|Object is locked
msg.mechOnly|此功能僅適用於力學／沙盒。|Available in Mechanics / sandbox only.
msg.needDynamic|至少需要一個動態物件|At least one dynamic object is required
msg.needTwo|請至少選取兩個物件|Select at least two objects
msg.noChart|沒有圖表資料|No chart data
msg.noData|沒有可匯出的資料|No data to export
msg.noJoints|尚未建立任何連接|No joints yet
msg.pickOneTwo|請選取 1 個物件（連接到世界）或 2 個物件|Select 1 object (to the world) or 2 objects
msg.presetLoaded|已載入實驗：{name}|Loaded experiment: {name}
msg.redo|已重做|Redo
msg.undo|已復原|Undo
msg.saved|已儲存「{name}」|Saved “{name}”
msg.sharedLoaded|已從分享連結載入場景|Scene loaded from share link
err.badJson|檔案不是有效的 JSON|The file is not valid JSON
err.clipboard|無法存取剪貼簿|Clipboard is not available
err.contextLost|WebGL 內容已遺失，請重新整理頁面|The WebGL context was lost; please reload the page
err.empty|場景中沒有可用的物件|The scene contains no usable objects
err.history|無法還原歷史紀錄|Could not restore history
err.invalidFile|無效的場景檔案|Invalid scene file
err.module|實驗模組發生錯誤|The experiment module hit an error
err.physics|物理引擎初始化失敗|Physics engine failed to initialise
err.physicsHint|無法載入 Rapier（WebAssembly）。請確認瀏覽器支援 WebAssembly 後重新載入。|Rapier (WebAssembly) could not be loaded. Make sure your browser supports WebAssembly and reload.
err.storage|無法寫入瀏覽器儲存空間（可能已滿或被停用）|Cannot write to browser storage (full or disabled)
err.tooLarge|場景過大，無法匯入|Scene is too large to import
err.unstable|偵測到數值不穩定，模擬已重設|Numerical instability detected; simulation was reset
err.webgl|無法建立 WebGL 繪圖環境|Could not create a WebGL context
err.webglHint|你的瀏覽器或顯示卡不支援 WebGL，或已被停用。請啟用硬體加速或改用較新的瀏覽器。|Your browser or GPU does not support WebGL, or it is disabled. Enable hardware acceleration or use a modern browser.
model.rigid|剛體力學由 Rapier 引擎以固定時間步長 1/240 s 數值求解（接觸、摩擦與恢復係數皆為數值近似）。所有讀數（速度、加速度、能量…）均取自引擎狀態；加速度＝速度差／時間步長，力 F＝ma。彈簧、滑輪繩與齒輪嚙合為自訂約束：彈簧遵循虎克定律 F＝−kx；滑輪為無質量、無摩擦的理想化模型；齒輪嚙合為理想運動學約束（ω₁r₁＝−ω₂r₂）。接觸摩擦／恢復係數為兩表面係數的乘積（地面為 1）。多關節系統的能量會有數 % 的數值耗散。|Rigid bodies are integrated numerically by Rapier with a fixed 1/240 s timestep (contacts, friction and restitution are numerical approximations). Every readout comes from engine state; acceleration = Δv/Δt and force F = ma. Springs, pulley ropes and gear meshes are custom constraints: springs obey Hooke's law F = −kx; the pulley is an ideal massless, frictionless model; gear mesh is an ideal kinematic constraint (ω₁r₁ = −ω₂r₂). Contact friction/restitution is the product of both surfaces (ground = 1). Multi-joint systems show a few % numerical energy dissipation.
pre.newton|牛頓運動定律|Newton's laws
pre.newton.desc|定力 F 推動質量 m 的木塊：a = (F − μmg)/m。比較理論與量測加速度，驗證 F = ma。|A constant force F pushes a block of mass m: a = (F − μmg)/m. Compare theory with measurement to verify F = ma.
pre.freefall|自由落體|Free fall
pre.freefall.desc|重球與輕球同時落下。無空氣阻力時同時著地（t = √(2h/g)）；開啟空氣阻力後輕球較慢。|A heavy and a light ball drop together. Without air they land together (t = √(2h/g)); with air drag the light one lags.
pre.projectile|拋體發射器|Projectile launcher
pre.projectile.desc|調整初速、仰角與高度，比較理論射程 R、最大高度與飛行時間與量測值；軌跡為拋物線。|Tune speed, angle and height; compare theoretical range, apex and flight time with measurements. The trajectory is a parabola.
pre.incline|斜面|Inclined plane
pre.incline.desc|木塊沿斜面滑下：a = g(sinθ − μcosθ)。可調整角度、摩擦與質量。|A block slides down an incline: a = g(sinθ − μcosθ). Adjust angle, friction and mass.
pre.elastic|彈性碰撞|Elastic collision
pre.elastic.desc|無摩擦地面上的一維碰撞（e = 1）：動量與動能皆守恆。|1-D collision on frictionless ground (e = 1): both momentum and kinetic energy are conserved.
pre.inelastic|非彈性碰撞|Inelastic collision
pre.inelastic.desc|恢復係數 e 可調（預設 0 ＝ 完全非彈性）：動量守恆，動能減少。|Adjustable restitution e (default 0 = perfectly inelastic): momentum conserved, kinetic energy lost.
pre.momentum|動量守恆（二維）|Momentum conservation (2-D)
pre.momentum.desc|兩球偏心碰撞，總動量向量（x、z 分量）守恆。|An off-centre collision of two balls; the total momentum vector (x and z components) is conserved.
pre.energy|能量守恆（滾動球）|Energy conservation (rolling ball)
pre.energy.desc|實心球沿斜面純滾動：a = (5/7)g sinθ。總機械能＝平動動能＋轉動動能＋位能。|A solid sphere rolls down an incline: a = (5/7)g sinθ. Mechanical energy = translational KE + rotational KE + PE.
pre.rotation|轉動與角動量|Rotational motion
pre.rotation.desc|定力矩 τ 驅動圓盤：α = τ/I，I = ½mr²。可查看角動量 L = Iω。|A constant torque τ drives a disc: α = τ/I with I = ½mr². Inspect angular momentum L = Iω.
pre.torque|力矩與槓桿|Torque & lever
pre.torque.desc|蹺蹺板兩側質量不同：淨力矩 = g(m₂d₂ − m₁d₁)。力矩平衡時保持水平。|A seesaw with different masses: net torque = g(m₂d₂ − m₁d₁). It stays level when torques balance.
pre.pendulum|單擺|Pendulum
pre.pendulum.desc|擺長 L 的單擺：小角度週期 T = 2π√(L/g)；大角度以橢圓積分求精確週期。|A pendulum of length L: small-angle period T = 2π√(L/g); the exact large-angle period uses elliptic integrals.
pre.double|雙擺|Double pendulum
pre.double.desc|混沌系統：微小的初始差異會迅速放大。軌跡已開啟；能量漂移為數值耗散。|A chaotic system: tiny initial differences grow quickly. Trails are on; energy drift is numerical dissipation.
pre.spring|彈簧振盪|Spring oscillation
pre.spring.desc|質量–彈簧系統：F = −kx，T = 2π√(m/k)。可加入阻尼並查看彈性位能。|Mass–spring system: F = −kx, T = 2π√(m/k). Add damping and watch the elastic potential energy.
pre.gears|齒輪傳動|Gear transmission
pre.gears.desc|主動齒輪受力矩驅動，帶動從動齒輪：ω₂/ω₁ = −r₁/r₂，輸出力矩 τ₂ = τ₁r₂/r₁（理想）。|A driver gear under torque turns a driven gear: ω₂/ω₁ = −r₁/r₂ and ideal output torque τ₂ = τ₁r₂/r₁.
pre.cradle|牛頓擺|Newton's cradle
pre.cradle.desc|拉起 1–4 顆球釋放，動量經由碰撞傳遞。恢復係數 e = 1 時動量與動能近乎守恆。|Lift 1–4 balls and release: momentum passes through collisions. With e = 1 momentum and energy are nearly conserved.
pre.pulley|滑輪系統（阿特伍德機）|Pulley system (Atwood)
pre.pulley.desc|a = (m₁ − m₂)g/(m₁ + m₂)，張力 T = 2m₁m₂g/(m₁ + m₂)。滑輪為無質量理想化模型。|a = (m₁ − m₂)g/(m₁ + m₂), tension T = 2m₁m₂g/(m₁ + m₂). The pulley is an ideal massless model.
pre.prism|稜鏡折射與色散|Prism refraction
pre.prism.desc|白光通過玻璃稜鏡，依柯西色散分成七色。|White light through a glass prism splits into seven colours by Cauchy dispersion.
pre.convex|凸透鏡|Convex lens
pre.convex.desc|平行光通過雙凸透鏡，以光線追跡求出焦點並與薄透鏡公式比較。|Parallel rays through a biconvex lens; the focal point from ray tracing is compared with the thin-lens formula.
pre.circuit|電路|Electrical circuit
pre.circuit.desc|互動電路：新增串聯／並聯電阻，查看電壓、電流、功率及克希何夫定律檢驗。|Interactive circuit: add series/parallel resistors and check voltage, current, power and Kirchhoff's laws.
pre.conduction|熱傳導|Thermal conduction
pre.conduction.desc|二維熱傳導方程式 ∂T/∂t = α∇²T 的熱圖；左右熱浴下趨近傅立葉穩態。|Heat map of ∂T/∂t = α∇²T in 2-D; with hot/cold baths it converges to the Fourier steady state.
pp.F|外力 F|Force F
pp.m|質量 m|Mass m
pp.mu|摩擦係數 μ|Friction μ
pp.h|高度 h|Height h
pp.air|空氣阻力|Air resistance
pp.v0|初速 v₀|Initial speed v₀
pp.ang|角度|Angle
pp.h0|發射高度|Launch height
pp.m1|質量 m₁|Mass m₁
pp.m2|質量 m₂|Mass m₂
pp.v1|球 1 初速 v₁|Initial speed v₁
pp.e|恢復係數 e|Restitution e
pp.b|偏心距 b|Impact parameter b
pp.tau|力矩 τ|Torque τ
pp.r|半徑 r|Radius r
pp.L|擺長 L|Length L
pp.th0|初始擺角 θ₀|Initial angle θ₀
pp.L1|擺長 L₁|Length L₁
pp.L2|擺長 L₂|Length L₂
pp.t1|初始角 θ₁|Initial θ₁
pp.t2|初始角 θ₂|Initial θ₂
pp.k|彈性係數 k|Spring constant k
pp.x0|初始位移 x₀|Initial displacement x₀
pp.c|阻尼係數 c|Damping c
pp.s2|從動輪尺寸比|Driven gear size
pp.load|負載阻尼|Load damping
pp.n|拉起球數|Balls lifted
pp.d1|力臂 d₁|Arm d₁
pp.d2|力臂 d₂|Arm d₂
opt.reflection|反射|Reflection
opt.refraction|折射與斯涅爾定律|Refraction & Snell's law
opt.tir|全內反射|Total internal reflection
opt.prism|稜鏡|Prism
opt.dispersion|光的色散|Light dispersion
opt.convex|凸透鏡與焦點|Convex lens & focus
opt.concave|凹透鏡|Concave lens
opt.mirror|面鏡|Mirrors
optp.theta|入射角 θ|Incident angle θ
optp.dist|光源距離|Source distance
optp.n1|折射率 n₁|Refractive index n₁
optp.n2|折射率 n₂|Refractive index n₂
optp.inc|稜鏡入射角|Incidence on prism
optp.apex|稜鏡頂角 A|Apex angle A
optp.np|稜鏡折射率 n(589 nm)|Prism index n(589 nm)
optp.disp|柯西色散係數 B|Cauchy coefficient B
optp.R|曲率半徑 R|Radius of curvature R
optp.nl|透鏡折射率|Lens index
optp.h|孔徑半高|Aperture half-height
optp.src|光源類型|Source type
optp.u|物距 u|Object distance u
optp.yo|光源離軸高度|Source off-axis height
optp.mtype|面鏡類型|Mirror type
optp.parallel|平行光|Parallel beam
optp.point|點光源|Point source
optp.plane|平面鏡|Plane mirror
optp.concaveM|凹面鏡|Concave mirror
optp.convexM|凸面鏡|Convex mirror
optics.desc.reflection|光線射向平滑鏡面：反射角等於入射角（θᵣ = θᵢ）。圓弧為量角標示。|A ray hits a smooth mirror: the reflection angle equals the incidence angle (θᵣ = θᵢ). Arcs mark the angles.
optics.desc.refraction|光線由介質 1 進入介質 2：n₁sinθ₁ = n₂sinθ₂。同時計算菲涅耳反射率，反射光與折射光亮度依能量比例顯示。|A ray passes from medium 1 into medium 2: n₁sinθ₁ = n₂sinθ₂. Fresnel reflectance is computed and the beam brightness shows the energy split.
optics.desc.tir|光由高折射率介質射向低折射率介質，入射角大於臨界角 θc = asin(n₂/n₁) 時發生全內反射。|Light going from a dense to a rarer medium beyond the critical angle θc = asin(n₂/n₁) is totally reflected.
optics.desc.prism|單色光穿過三角稜鏡，兩次折射產生偏向角 δ。拖曳入射角可看到最小偏向角。|Monochromatic light through a triangular prism is refracted twice, giving deviation δ. Vary the incidence angle to find the minimum deviation.
optics.desc.dispersion|折射率隨波長變化（柯西公式 n = A + B/λ²），七種波長的光被折射到不同角度。|The index varies with wavelength (Cauchy n = A + B/λ²), so seven wavelengths leave at different angles.
optics.desc.convex|雙凸透鏡以球面光線追跡成像：平行光匯聚於焦點；點光源可求像距。|A biconvex lens traced surface by surface: parallel light converges at the focus; a point source gives an image distance.
optics.desc.concave|雙凹透鏡使光線發散，反向延伸線交於虛焦點（f < 0）。|A biconcave lens diverges rays; their back-extensions meet at a virtual focus (f < 0).
optics.desc.mirror|平面、凹面與凸面鏡：凹面鏡將平行光聚於 f = R/2；凸面鏡形成虛焦點。|Plane, concave and convex mirrors: a concave mirror focuses parallel light at f = R/2; a convex mirror has a virtual focus.
optics.model|幾何光學（光線追跡）：光線與透鏡／稜鏡的多邊形表面求交，在每個表面以斯涅爾定律折射（或全反射），法線取自曲面插值，因此包含球面像差。薄透鏡焦距 f = R/[2(n−1)] 僅為近似比較值。稜鏡／透鏡內不計部分反射（僅界面模式計算菲涅耳）。不含波動效應（繞射、偏振）。|Geometric optics (ray tracing): rays are intersected with polygonal lens/prism surfaces and refracted (or totally reflected) with Snell's law using interpolated surface normals, so spherical aberration is included. The thin-lens focal length f = R/[2(n−1)] is only an approximate reference. Partial reflection inside prisms/lenses is ignored (Fresnel is only computed in interface modes). No wave effects (diffraction, polarisation).
wav.transverse|橫波|Transverse wave
wav.longitudinal|縱波|Longitudinal wave
wav.interference|干涉|Interference
wav.standing|駐波|Standing wave
wav.reflection|波的反射|Wave reflection
wav.refraction|波的折射|Wave refraction
wav.diffraction|繞射（狹縫）|Diffraction (slits)
wav.doppler|都卜勒效應|Doppler effect
wavp.f|頻率 f|Frequency f
wavp.lam|波長 λ|Wavelength λ
wavp.A|振幅 A|Amplitude A
wavp.phi|相位 φ|Phase φ
wavp.v|傳播速度 v|Propagation speed v
wavp.px|探測點位置 x|Probe position x
wavp.harm|諧波數 n|Harmonic n
wavp.d|間距 d|Separation d
wavp.a|狹縫寬度 a|Slit width a
wavp.slits|狹縫數|Slits
wavp.single|單縫|Single slit
wavp.double|雙縫|Double slit
wavp.xw|牆的位置|Wall position
wavp.theta|入射角 θ|Incident angle θ
wavp.vr|波速比 v₂/v₁|Speed ratio v₂/v₁
wavp.mach|波源速度（馬赫數）|Source speed (Mach)
waves.desc.transverse|質點垂直於傳播方向振動：y = A sin(kx − ωt + φ)，v = fλ。|Particles move perpendicular to propagation: y = A sin(kx − ωt + φ), v = fλ.
waves.desc.longitudinal|質點沿傳播方向振動，顏色顯示疏（藍）密（紅）。|Particles move along the propagation direction; colour shows rarefaction (blue) and compression (red).
waves.desc.interference|兩個同相點波源的疊加。相位差與間距決定建設性／破壞性干涉；圖表為螢幕上的強度分布。|Superposition of two point sources. Phase difference and spacing set constructive/destructive interference; the chart shows intensity on a screen.
waves.desc.standing|兩端固定的弦：入射波與反射波疊加成駐波，λₙ = 2L/n，fₙ = nv/2L。|A string fixed at both ends: incident and reflected waves form standing waves, λₙ = 2L/n, fₙ = nv/2L.
waves.desc.reflection|波在固定端牆反射（相位反轉 180°），以鏡像波源法計算；反射角等於入射角。|A wave reflects from a fixed wall (180° phase flip), computed with an image source; angle of reflection equals incidence.
waves.desc.refraction|平面波跨越介質界面：波速改變使波長改變，頻率不變；sinθ₁/sinθ₂ = v₁/v₂。超過臨界角時為全反射（含衰逝波）。|A plane wave crosses an interface: the speed change alters the wavelength, not the frequency; sinθ₁/sinθ₂ = v₁/v₂. Beyond the critical angle it is totally reflected (evanescent wave).
waves.desc.diffraction|平面波通過狹縫（惠更斯原理）。單縫第一暗紋 sinθ = λ/a；雙縫亮紋間距 ≈ λL/d。|A plane wave through slits (Huygens' principle). Single slit first minimum sinθ = λ/a; double-slit fringe spacing ≈ λL/d.
waves.desc.doppler|移動波源的波前被壓縮（前方）或拉長（後方）：f′ = f·v/(v ∓ vₛ)。馬赫數 > 1 形成馬赫錐。|Wavefronts of a moving source bunch up ahead and stretch behind: f′ = f·v/(v ∓ vₛ). Mach > 1 forms a Mach cone.
waves.model|解析波動模型（不是剛體引擎）：波形由 y = A sin(kx − ωt + φ) 的精確公式計算，圖表取自同一公式。縱波顯示振幅受限以避免質點交錯。|Analytical wave model (not the rigid-body engine): waveforms come from the exact formula y = A sin(kx − ωt + φ), and charts sample the same formula. The displayed longitudinal amplitude is clamped to avoid crossing particles.
waves.model2d|二維波場以複振幅疊加計算（點波源以 1/√r 衰減；繞射使用 18 點惠更斯小波；折射只畫透射波，全反射才加入反射波，未計算部分反射振幅）。屬簡化教學模型，並非完整波動方程式數值解。|2-D fields use complex-amplitude superposition (point sources decay as 1/√r; diffraction uses 18-point Huygens wavelets; refraction draws only the transmitted wave, adding a reflected wave only under total reflection — partial-reflection amplitudes are ignored). A simplified educational model, not a full wave-equation solver.
em.charges|點電荷、電場與電位|Point charges, field & potential
em.magwire|載流導線的磁場|Magnetic field of a wire
em.magdipole|條形磁鐵（磁偶極）|Bar magnet (dipole)
em.lorentz|帶電粒子在磁場／電場中|Charged particle in B & E
em.circuit|直流電路（串並聯）|DC circuit (series/parallel)
em.rc|RC 充放電電路|RC charging circuit
em.electron|電子|Electron
em.proton|質子|Proton
em.alpha|α 粒子|Alpha particle
emp.q1|電荷 q₁|Charge q₁
emp.q2|電荷 q₂|Charge q₂
emp.q3|電荷 q₃|Charge q₃
emp.qt|測試電荷 q₀|Test charge q₀
emp.view|顯示|Display
emp.field|電場箭頭|Field arrows
emp.potential|電位曲面|Potential surface
emp.both|兩者|Both
emp.c1x|q₁ x|q₁ x
emp.c1y|q₁ y|q₁ y
emp.c2x|q₂ x|q₂ x
emp.c2y|q₂ y|q₂ y
emp.c3x|q₃ x|q₃ x
emp.c3y|q₃ y|q₃ y
emp.prx|探針 x|Probe x
emp.pry|探針 y|Probe y
emp.I|電流 I|Current I
emp.M|磁矩 m|Magnetic moment m
emp.alpha|磁鐵方向角|Magnet angle
emp.species|粒子種類|Particle
emp.v0|初速 v₀|Initial speed v₀
emp.ang|速度方向|Direction
emp.B|磁場 B（朝向螢幕外）|Magnetic field B (out of screen)
emp.E|電場 E（沿 +y）|Electric field E (along +y)
emp.restart|重新發射粒子|Re-launch particle
emp.V|電動勢 ε|EMF ε
emp.rint|電池內電阻 r|Internal resistance r
emp.sw|開關閉合（RC：充電）|Switch closed (RC: charging)
emp.addS|新增串聯電阻|Add series resistor
emp.addP|新增並聯電阻|Add parallel resistor
emp.remove|移除最後一個|Remove last
emp.sel|選擇電阻編號|Select resistor #
emp.Rsel|選取的電阻值|Selected resistance
emp.R|電阻 R|Resistance R
emp.C|電容 C|Capacitance C
emp.tscale|時間倍率|Time multiplier
em.desc.charges|拖曳電荷與探針。電場 E = Σ kq/r²，電位 V = Σ kq/r；曲面高度為電位，等位線為曲面上的細線。|Drag the charges and the probe. E = Σ kq/r², V = Σ kq/r; the surface height is the potential, thin lines on it are equipotentials.
em.desc.magwire|無限長直導線：B = μ₀I/(2πr)，磁場線為同心圓（右手定則）。拖曳探針讀取磁場。|An infinite straight wire: B = μ₀I/(2πr) with circular field lines (right-hand rule). Drag the probe to read the field.
em.desc.magdipole|點磁偶極模型：B = (μ₀/4π)[3(m·r̂)r̂ − m]/r³。可旋轉磁鐵方向。|Point-dipole model: B = (μ₀/4π)[3(m·r̂)r̂ − m]/r³. Rotate the magnet's direction.
em.desc.lorentz|以 Boris 積分器求解洛倫茲力 F = q(E + v×B)。僅有 B 時為圓周運動 r = mv/(qB)；加入 E 產生 E×B 漂移。|The Lorentz force F = q(E + v×B) is integrated with the Boris pusher. With B only the path is a circle r = mv/(qB); adding E gives E×B drift.
em.desc.circuit|按「新增串聯／並聯電阻」建構電路。黃色粒子速度正比於電流。顯示各電阻的電壓、電流與功率，並檢驗歐姆定律與克希何夫定律。|Use “Add series/parallel resistor” to build a circuit. Yellow particle speed ∝ current. Per-resistor voltage, current and power are shown with Ohm and Kirchhoff checks.
em.desc.rc|RC 電路：切換開關充電或放電。V_C = V(1 − e^(−t/RC))（充電），圖表比較數值積分（RK4）與解析解。|RC circuit: toggle the switch to charge or discharge. V_C = V(1 − e^(−t/RC)) while charging; the chart compares RK4 numerics with the analytic solution.
em.model.charges|二維平面上的庫侖疊加（精確公式，含 0.15 m 軟化半徑避免奇異）。電荷以 µC 為單位，距離以 m 為單位。|Coulomb superposition in a 2-D plane (exact formula with a 0.15 m softening radius to avoid singularities). Charges in µC, distances in m.
em.model.magwire|畢奧–沙伐定律對無限長導線的解析結果；僅顯示垂直導線的平面。|Analytic Biot–Savart result for an infinite wire; only the plane perpendicular to the wire is shown.
em.model.magdipole|點偶極近似，僅在磁鐵外部有效（r < 0.6 m 內數值被截斷）。|Point-dipole approximation, valid outside the magnet (clamped for r < 0.6 m).
em.model.lorentz|使用真實 SI 常數。為了可視化，空間依軌道半徑自動縮放、時間縮放為每個迴旋週期約 4 秒（讀數已標示）。|Real SI constants are used. For visibility space is auto-scaled to the orbit radius and time is scaled to about 4 s per cyclotron period (shown in the readouts).
em.model.circuit|理想導線與電阻，穩態直流分析：I = ε/(R_總 + r)；各並聯組電壓 V = IR_組。導電粒子速度為示意（與電流成正比但有上限）。|Ideal wires and resistors in steady-state DC: I = ε/(R_total + r); each parallel group has V = I·R_group. Particle speed is illustrative (∝ current, capped).
em.model.rc|RC 微分方程 dq/dt = (V − q/C)/R 以 RK4 積分；時間倍率可加速顯示，物理時間以讀數為準。|The RC ODE dq/dt = (V − q/C)/R is integrated with RK4; the time multiplier speeds up the display while charts use physical time.
th.conduction|熱傳導（二維熱圖）|Thermal conduction (2-D heat map)
th.convection|熱對流|Convection
th.radiation|熱輻射|Thermal radiation
th.expansion|熱膨脹與比熱|Thermal expansion & heating
th.calorimetry|比熱容量與熱平衡|Specific heat & calorimetry
th.gas|理想氣體與活塞|Ideal gas & piston
thp.mat|材料|Material
thp.Th|高溫 T_h|Hot temperature T_h
thp.Tc|低溫 T_c|Cold temperature T_c
thp.pattern|初始／邊界條件|Initial / boundary condition
thp.auto|自動時間縮放|Auto time scaling
thp.tscale|時間倍率|Time multiplier
thp.T0|初始溫度|Initial temperature
thp.eps|發射率 ε|Emissivity ε
thp.rad|半徑|Radius
thp.Tenv|環境溫度|Ambient temperature
thp.L0|初始長度 L₀|Initial length L₀
thp.P|加熱功率 P|Heating power P
thp.mass|質量 m|Mass m
thp.exag|視覺放大倍率|Visual exaggeration
thp.mm|質量|Mass
thp.T1|金屬初始溫度|Metal initial temperature
thp.m2|水的質量|Water mass
thp.T2|水初始溫度|Water initial temperature
thp.h|熱傳導率 hA|Thermal conductance hA
thp.proc|熱力過程|Process
thp.n|莫耳數 n|Moles n
thp.Tg|溫度 T|Temperature T
thp.Vg|體積 V|Volume V
thp.hot|底板加熱|Plate heating
thp.pLR|左右熱浴|Left/right baths
thp.pDisc|中央熱點（絕熱邊界）|Hot disc (insulated)
thp.pDiscCold|中央熱點（邊緣定溫）|Hot disc (cold edges)
thp.free|自由（T、V）|Free (T, V)
thp.isothermal|等溫（波以耳）|Isothermal (Boyle)
thp.isobaric|等壓（查理）|Isobaric (Charles)
thp.isochoric|等容|Isochoric
thp.adiabatic|絕熱|Adiabatic
th.desc.conduction|顏色表示溫度（藍冷紅熱，細線為等溫線）。傅立葉定律 q = −k∇T；左右熱浴最終趨近線性溫度分布。|Colour shows temperature (blue cold, red hot, thin lines are isotherms). Fourier's law q = −k∇T; with side baths it converges to a linear profile.
th.desc.convection|底部熱板加熱流體塊，浮力 a ∝ gβΔT 使熱流體上升、冷流體下沉。|The bottom plate heats fluid parcels; buoyancy a ∝ gβΔT lifts hot parcels while cold ones sink.
th.desc.radiation|史特凡–波茲曼定律 P = εσA(T⁴ − T_env⁴)：高溫球體冷卻並發光，顏色取自黑體色溫。|Stefan–Boltzmann law P = εσA(T⁴ − T_env⁴): a hot sphere cools and glows with its blackbody colour.
th.desc.expansion|加熱桿：m·c·dT/dt = P − h(T − T_env)，伸長量 ΔL = αL₀ΔT。桿的視覺伸長已放大。|A heated bar: m·c·dT/dt = P − h(T − T_env), elongation ΔL = αL₀ΔT. The visual elongation is exaggerated.
th.desc.calorimetry|熱金屬投入水中。能量守恆：m₁c₁(T₁ − T_f) = m₂c₂(T_f − T₂)；模擬以牛頓冷卻式交換熱量並趨近 T_f。|A hot metal block in water. Energy conservation: m₁c₁(T₁ − T_f) = m₂c₂(T_f − T₂); the simulation exchanges heat by Newtonian conduction and approaches T_f.
th.desc.gas|理想氣體 PV = nRT。粒子動畫示意分子動力論；壓力讀數由 PV = nRT 計算，並與粒子撞擊活塞的壓力比較。|Ideal gas PV = nRT. The particles illustrate kinetic theory; pressure comes from PV = nRT and is compared with the particle impacts on the piston.
th.model.conduction|二維顯式有限差分（64×40 格，穩定條件 Δt ≤ Δx²/4α），使用真實材料 k、ρ、c。為了在數秒內看見結果，物理時間被加速（倍率已標示）。|2-D explicit finite differences (64×40 cells, stability Δt ≤ Δx²/4α) with real k, ρ, c. Physical time is accelerated so results appear in seconds (multiplier shown).
th.model.convection|簡化的流體塊（parcel）模型：浮力、阻力、與局部平均交換熱量，不求解 Navier–Stokes 方程式，僅定性展示對流。|A simplified fluid-parcel model: buoyancy, drag and heat exchange with the local mean — it does not solve Navier–Stokes and is only qualitative.
th.model.radiation|以 RK4 積分 m·c·dT/dt = −εσA(T⁴ − T_env⁴)；T_env ≈ 0 時另畫解析解 T = T₀/(1 + 3εσAT₀³t/mc)^(1/3)。時間倍率可加速顯示。|RK4 integration of m·c·dT/dt = −εσA(T⁴ − T_env⁴); with T_env ≈ 0 the analytic solution T = T₀/(1 + 3εσAT₀³t/mc)^(1/3) is overlaid. A time multiplier speeds up display.
th.model.expansion|線性熱膨脹 ΔL = αL₀ΔT 為近似（α 視為常數）；自然冷卻係數固定 3 W/K，環境 293.15 K。|Linear expansion ΔL = αL₀ΔT is an approximation (constant α); natural cooling is fixed at 3 W/K with a 293.15 K environment.
th.model.calorimetry|集總熱容模型（金屬與水各自均勻溫度），忽略蒸發與容器熱容；水比熱 4186 J/(kg·K)。|Lumped-capacity model (uniform temperature in metal and water), ignoring evaporation and the container; water c = 4186 J/(kg·K).
th.model.gas|狀態變數用精確的理想氣體定律；活塞移動依過程設定（等溫、等壓、等容、絕熱 γ = 5/3）。粒子為約化單位的示意模擬（N = 140，無分子間作用力）。|State variables use the exact ideal-gas law; piston motion follows the chosen process (isothermal, isobaric, isochoric, adiabatic γ = 5/3). Particles are an illustrative reduced-unit simulation (N = 140, no intermolecular forces).
ro.Bang|磁場方向|B direction
ro.Bmag|磁場強度 B|Field strength B
ro.BtheoryWire|理論值 μ₀I/(2πr)|Theory μ₀I/(2πr)
ro.Eang|電場方向|E direction
ro.Emag|電場強度 E|Field strength E
ro.Lnow|目前長度 L|Current length L
ro.Qgained|水獲得的熱量|Heat gained by water
ro.Qlost|金屬釋出的熱量|Heat lost by metal
ro.Qresid|熱量殘差|Heat residual
ro.Tbar|桿溫度|Bar temperature
ro.Tcenter|中心溫度|Centre temperature
ro.Tcold|冷板溫度|Cold plate
ro.Tfinal|理論平衡溫度 T_f|Predicted equilibrium T_f
ro.Tgas|氣體溫度 T|Gas temperature T
ro.Thot|熱板溫度|Hot plate
ro.Tmean|平均溫度|Mean temperature
ro.Tmetal|金屬溫度|Metal temperature
ro.Tsurf|表面溫度|Surface temperature
ro.Twater|水溫|Water temperature
ro.Uint|內能 U = 3nRT/2|Internal energy U = 3nRT/2
ro.aMeas|量測加速度|Measured acceleration
ro.aRollTheory|純滾動理論加速度 (5/7)g sinθ|Theory a (rolling) (5/7)g sinθ
ro.aTheory|理論加速度|Theoretical acceleration
ro.airOn|空氣阻力|Air resistance
ro.alpha|熱擴散率 α|Thermal diffusivity α
ro.alphaLin|線膨脹係數 α|Linear expansion coeff. α
ro.alphaMeas|量測角加速度|Measured angular acceleration
ro.alphaTheory|理論角加速度|Theoretical angular acceleration
ro.ampl|振幅|Amplitude
ro.angMom|角動量 L|Angular momentum L
ro.angle1|球 1 出射角|Ball 1 exit angle
ro.angle2|球 2 出射角|Ball 2 exit angle
ro.angleNow|目前角度|Current angle
ro.antinodes|波腹數|Antinodes
ro.area|表面積 A|Surface area A
ro.beta|體膨脹係數 β ≈ 1/T|Expansion coeff. β ≈ 1/T
ro.betaVol|體膨脹係數 β ≈ 3α|Volumetric coeff. β ≈ 3α
ro.cMetal|金屬比熱 c|Metal specific heat c
ro.charge|電荷|Charge
ro.coulomb|庫侖常數|Coulomb constant
ro.crit|臨界角|Critical angle
ro.current|電流 I|Current I
ro.cyclFreq|迴旋頻率|Cyclotron frequency
ro.cyclPeriod|迴旋週期|Cyclotron period
ro.dL|伸長量 ΔL|Elongation ΔL
ro.dT|溫度變化 ΔT|Temperature change ΔT
ro.devMeasured|偏向角（光線追跡）|Deviation (ray trace)
ro.devMin|最小偏向角|Minimum deviation
ro.devTheory|偏向角（公式）|Deviation (formula)
ro.disp|位移 x|Displacement x
ro.dispAmpEff|顯示振幅（已限制）|Displayed amplitude (clamped)
ro.dp|動量變化|Momentum change
ro.drift|E×B 漂移速率|E×B drift speed
ro.e0|初始能量|Initial energy
ro.eDrift|能量漂移|Energy drift
ro.eSpring|彈性位能|Spring energy
ro.eSys|系統總能量|System total energy
ro.eTotal|總機械能|Total mechanical energy
ro.ek|動能|Kinetic energy
ro.ek0|初始動能|Initial kinetic energy
ro.ekNow|目前動能|Current kinetic energy
ro.ekR|轉動動能|Rotational KE
ro.ekT|平動動能|Translational KE
ro.emf|電動勢 ε|EMF ε
ro.energyC|電容儲能|Capacitor energy
ro.ep|位能|Potential energy
ro.epNow|重力位能|Gravitational PE
ro.exag|視覺放大倍率|Visual exaggeration
ro.fAheadMeas|前方量測頻率|Measured f (ahead)
ro.fAheadTheory|前方理論頻率|Theory f (ahead)
ro.fBehindMeas|後方量測頻率|Measured f (behind)
ro.fBehindTheory|後方理論頻率|Theory f (behind)
ro.fFric|摩擦力|Friction force
ro.fMeasured|量測焦距|Measured focal length
ro.fNet|淨力|Net force
ro.fPar|沿斜面分力 mg sinθ|Parallel component mg sinθ
ro.fTheory|理論焦距|Theoretical focal length
ro.flightMeas|量測飛行時間|Measured flight time
ro.flightTheory|理論飛行時間|Theoretical flight time
ro.fluxMeas|量測熱通量|Measured heat flux
ro.fluxTheory|理論熱通量（傅立葉）|Theory flux (Fourier)
ro.fma|F = ma（量測）|F = ma (measured)
ro.fn|第 n 諧波頻率|n-th harmonic frequency
ro.force|作用力|Force
ro.freq|頻率 f|Frequency f
ro.fringeTheory|理論條紋間距|Theory fringe spacing
ro.hMaxMeas|量測最大高度|Measured max height
ro.hMaxTheory|理論最大高度|Theoretical max height
ro.harmonic|諧波數 n|Harmonic n
ro.heatCap|熱容量 C|Heat capacity C
ro.heatCapS|熱容量 C = mc|Heat capacity C = mc
ro.heatFlux|垂直熱通量 ⟨v_y T′⟩|Vertical heat flux ⟨v_y T′⟩
ro.heatIn|輸入熱量|Heat supplied
ro.heatLost|損失熱量|Heat lost
ro.hooke|虎克力 F = kx|Hooke force F = kx
ro.iMeas|量測轉動慣量 L/ω|Measured inertia L/ω
ro.iTheory|理論轉動慣量 ½mr²|Theory inertia ½mr²
ro.kcl|克希何夫電流律殘差|KCL residual
ro.kcond|熱傳導係數 k|Thermal conductivity k
ro.ke|動能|Kinetic energy
ro.keLossTheory|理論動能損失|Theory KE loss
ro.kineticRatio|動力論／理想氣體壓力比|Kinetic ÷ ideal-gas pressure
ro.kvl|克希何夫電壓律殘差|KVL residual
ro.lam2|介質 2 波長|Wavelength in medium 2
ro.lightY|輕球高度|Light ball height
ro.mach|馬赫數|Mach number
ro.machAngle|馬赫錐半角|Mach cone half-angle
ro.magnification|放大率 m|Magnification m
ro.massS|質量|Mass
ro.material|材料|Material
ro.maxima|亮紋數|Number of maxima
ro.meanKE|平均動能（相對）|Mean KE (relative)
ro.minMeas|量測第一極小角|Measured first minimum
ro.minTheory|理論第一極小角 asin(λ/a)|Theory first minimum asin(λ/a)
ro.mirrorLaw|反射定律|Law of reflection
ro.moles|莫耳數 n|Moles n
ro.mu0|真空磁導率|Vacuum permeability
ro.nAt589|折射率 n(589 nm)|Index n(589 nm)
ro.nRed|紅光折射率 (650 nm)|Index (red, 650 nm)
ro.nViolet|紫光折射率 (420 nm)|Index (violet, 420 nm)
ro.nodes|節點數|Nodes
ro.normal|正向力 N|Normal force N
ro.nrel|相對折射率 n₂/n₁|Relative index n₂/n₁
ro.ohmCheck|歐姆定律檢驗 IR − ε|Ohm check IR − ε
ro.omega|角頻率／角速度 ω|Angular frequency / velocity ω
ro.omega1|主動輪角速度 ω₁|Driver ω₁
ro.omega2|從動輪角速度 ω₂|Driven ω₂
ro.omegaSmall|小角度角頻率 √(g/L)|Small-angle ω = √(g/L)
ro.p0|初始動量|Initial momentum
ro.pBattery|電池輸出功率|Battery power
ro.pDiss|總消耗功率|Total dissipated power
ro.pIn|輸入功率|Input power
ro.pNow|目前動量|Current momentum
ro.pR|電阻功率 I²R|Resistor power I²R
ro.pRad|輻射淨功率|Net radiated power
ro.pSys|系統動量|System momentum
ro.pathDiffMax|波源間距（最大路徑差）|Source spacing (max path diff.)
ro.pe|電位能 qV|Potential energy qV
ro.period|週期 T|Period T
ro.phaseShift|反射相位移|Reflection phase shift
ro.plateSize|平板尺寸|Plate size
ro.pmass|粒子質量|Particle mass
ro.potential|電位 V|Potential V
ro.power|透鏡焦度|Lens power
ro.pressure|壓力 P|Pressure P
ro.pressureAtm|壓力（大氣壓）|Pressure (atm)
ro.probePos|探針位置|Probe position
ro.pvnrt|PV/(nRT)|PV/(nRT)
ro.pxNow|總動量 x 分量|Total momentum x
ro.pzNow|總動量 z 分量|Total momentum z
ro.rMeas|量測半徑|Measured radius
ro.rTheory|理論半徑 mv/(qB)|Theory radius mv/(qB)
ro.radE|累計輻射能|Radiated energy
ro.rangeMeas|量測射程|Measured range
ro.rangeTheory|理論射程|Theoretical range
ro.ratioMeas|量測齒輪比 ω₂/ω₁|Measured ratio −ω₂/ω₁
ro.ratioRot|轉動／平動動能比|Rotational ÷ translational KE
ro.ratioTheory|理論齒輪比 r₁/r₂|Theory ratio r₁/r₂
ro.reflLaw|反射定律|Law of reflection
ro.reflect|反射率|Reflectance
ro.rising|上升中的流體塊|Rising parcels
ro.rtotal|總電阻|Total resistance
ro.sliding|滑動中|Sliding
ro.snell1|n₁ sinθ₁|n₁ sinθ₁
ro.snell2|n₂ sinθ₂|n₂ sinθ₂
ro.speed|速率／波速|Speed
ro.sphAb|球面像差（邊緣光線焦點偏移）|Spherical aberration (marginal focus shift)
ro.spread|色散角度範圍（紅–紫）|Spectral spread (red–violet)
ro.stateSlide|狀態|State
ro.static|靜止（摩擦足夠）|Static (friction holds)
ro.tExact|精確週期（橢圓積分）|Exact period (elliptic)
ro.tFallMeas|量測落下時間|Measured fall time
ro.tFallTheory|理論落下時間|Theoretical fall time
ro.tMeas|量測週期|Measured period
ro.tSmall|小角度週期 2π√(L/g)|Small-angle period 2π√(L/g)
ro.tTheory|理論週期|Theoretical period
ro.tau|時間常數 τ = RC|Time constant τ = RC
ro.tauLeft|左側力矩 m₁gd₁|Left torque m₁gd₁
ro.tauNet|淨力矩|Net torque
ro.tauOut|理想輸出力矩|Ideal output torque
ro.tauRight|右側力矩 m₂gd₂|Right torque m₂gd₂
ro.tension|繩張力（約）|Tension (approx.)
ro.tensionMeas|量測張力 m(g + a)|Measured tension m(g + a)
ro.tensionTheory|理論張力|Theoretical tension
ro.terminal|端電壓|Terminal voltage
ro.theta1|入射角 θ₁|Incidence θ₁
ro.theta2|折射角 θ₂|Refraction θ₂
ro.thetaR|反射角 θᵣ|Reflection θᵣ
ro.timeScale|時間縮放|Time scale
ro.tphys|物理時間|Physical time
ro.transmit|穿透率|Transmittance
ro.tscale|時間倍率|Time multiplier
ro.tscaleEff|有效時間倍率|Effective time multiplier
ro.v1Meas|量測 v₁′|Measured v₁′
ro.v1Theory|理論 v₁′|Theory v₁′
ro.v2|介質 2 波速|Wave speed in medium 2
ro.v2Meas|量測 v₂′|Measured v₂′
ro.v2Theory|理論 v₂′|Theory v₂′
ro.vImpMeas|量測落地速率|Measured impact speed
ro.vImpTheory|理論落地速率|Theoretical impact speed
ro.vMeasured|量測像距 v|Measured image distance v
ro.vNow|目前速度|Current velocity
ro.vTheory|理論像距（公式）|Theory image distance
ro.vc|電容電壓 V_C|Capacitor voltage V_C
ro.volume|體積 V|Volume V
ro.vr|電阻電壓 V_R|Resistor voltage V_R
ro.vs|波源速度 vₛ|Source speed vₛ
ro.wavelength|波長 λ|Wavelength λ
ro.wavenumber|波數 k|Wavenumber k
ro.wien|維恩峰值波長|Wien peak wavelength
ro.resLine|電阻 R|Resistor R
ro.resV|電阻|Resistor
ch.Bdist|磁場強度 vs 距離|Field strength vs distance
ch.Bfield|磁場強度|Field strength
ch.Ex|電場 Eₓ|Electric field Eₓ
ch.acceleration|加速度|Acceleration
ch.adiabat|絕熱線 PVᵞ = 常數|Adiabat PVᵞ = const
ch.amag|加速度大小|Acceleration magnitude
ch.analytic|解析解|Analytic solution
ch.ax|aₓ|aₓ
ch.ay|a_y|a_y
ch.az|a_z|a_z
ch.cauchy|折射率 vs 波長（柯西）|Index vs wavelength (Cauchy)
ch.convFlux|熱通量隨時間|Heat flux vs time
ch.current|電流|Current
ch.dL|伸長量|Elongation
ch.dLvsT|伸長量 vs 溫度|Elongation vs temperature
ch.dev|偏向角|Deviation
ch.deviation|偏向角 vs 入射角|Deviation vs incidence
ch.dispSpace|位移 vs 位置|Displacement vs position
ch.displacement|位移|Displacement
ch.distance|距離|Distance
ch.doppler|觀測頻率 vs 馬赫數|Observed frequency vs Mach
ch.ek|動能 Eₖ|Kinetic Eₖ
ch.energy|能量|Energy
ch.ep|位能 Eₚ|Potential Eₚ
ch.esys|系統總能量|System total
ch.etotal|機械能 E|Mechanical E
ch.fieldLine|沿線電場 Eₓ|Eₓ along line
ch.fmag|力大小|Force magnitude
ch.force|力|Force
ch.fresnel|菲涅耳反射率|Fresnel reflectance
ch.fx|Fₓ|Fₓ
ch.fy|F_y|F_y
ch.fz|F_z|F_z
ch.height|高度／位移|Displacement
ch.heightProfile|溫度 vs 高度|Temperature vs height
ch.iT|電流 I(t)|Current I(t)
ch.imageDist|像距 vs 物距|Image vs object distance
ch.imgDist|像距|Image distance
ch.incidence|入射角|Incidence angle
ch.index|折射率|Refractive index
ch.intensity|螢幕上的強度分布|Intensity on screen
ch.intensityRel|相對強度|Relative intensity
ch.isotherm|等溫線 PV = 常數|Isotherm PV = const
ch.ivr|I–V 特性|I–V characteristic
ch.machNumber|馬赫數|Mach number
ch.mirrorEq|面鏡公式|Mirror equation
ch.now|目前|Now
ch.objDist|物距|Object distance
ch.obsFreq|觀測頻率|Observed frequency
ch.ohm|歐姆定律 I = V/R|Ohm's law I = V/R
ch.path|狀態路徑|State path
ch.periods|迴旋週期數|Cyclotron periods
ch.position|位置|Position
ch.potLine|沿線電位|Potential along line
ch.potential|電位|Potential
ch.pressure|壓力|Pressure
ch.probe|探測點|Probe
ch.pvDiagram|P–V 圖|P–V diagram
ch.radPower|輻射功率|Radiated power
ch.rint|內電阻壓降|Internal drop
ch.screenPos|螢幕位置|Screen position
ch.snell|斯涅爾定律曲線|Snell's law curve
ch.speed|速率|Speed
ch.speedT|速率 vs 時間|Speed vs time
ch.stage|電阻組編號|Resistor group #
ch.tempProfile|溫度剖面（中線）|Temperature profile (mid-line)
ch.tempSim|模擬溫度|Simulated temperature
ch.tempSteady|穩態線性解|Steady-state linear
ch.tempTime|溫度 vs 時間|Temperature vs time
ch.temperature|溫度|Temperature
ch.theta1|入射角 θ₁|Incidence θ₁
ch.theta2|折射角 θ₂|Refraction θ₂
ch.thetaR|反射角 θᵣ|Reflection θᵣ
ch.thinLens|薄透鏡公式|Thin-lens formula
ch.time|時間|Time
ch.trajectory|軌跡|Trajectory
ch.vcSim|V_C（數值）|V_C (numeric)
ch.vcT|電容電壓 V_C(t)|Capacitor voltage V_C(t)
ch.vcTheory|V_C（解析）|V_C (analytic)
ch.vdrop|各組電壓降|Voltage drop per group
ch.velocity|速度|Velocity
ch.voltage|電壓|Voltage
ch.volume|體積|Volume
ch.vx|vₓ|vₓ
ch.vy|v_y|v_y
ch.vz|v_z|v_z
ch.waveSpace|波形 y(x)|Waveform y(x)
ch.waveTime|探測點 y(t)|Probe y(t)
ch.waveform|波形|Waveform
ch.wavelength|波長|Wavelength
ch.x|x|x
ch.y|y|y
ch.z|z|z
`;

export const zh: Record<string, string> = {};
export const en: Record<string, string> = {};
for (const line of RAW.split("\n")) {
  if (!line.trim()) continue;
  const i = line.indexOf("|");
  const j = line.indexOf("|", i + 1);
  const k = line.slice(0, i);
  zh[k] = line.slice(i + 1, j);
  en[k] = line.slice(j + 1);
}
