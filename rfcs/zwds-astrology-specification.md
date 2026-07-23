# Zi Wei Dou Shu (ZWDS) Web Astrology Specification
## Derived from Master Ni Hai-hsia's (倪海厦) *Tian Ji* (天纪) Teachings

This document serves as a developer-ready architectural and mathematical specification for building a web-based fortune-telling application. In accordance with strict requirements, **all Traditional Chinese Medicine (TCM) references, organ mappings, and health diagnostic rules have been completely decoupled and removed.** 

This specification focuses purely on the **core destiny-calculation, astrological logic, spatial Yang Zhai (地道) alignments, human actions (人道), and dynamic time transformations** of Master Ni's system.

---

## 1. Data Models & Schemas

To implement this on a web application, we must maintain schemas for both the raw input data (client metadata) and the processed outputs (the 12-palace astrological matrix).

### 1.1 User Birth & Space Data Input Schema (JSON)
This schema collects the necessary astronomical, temporal, and spatial variables required to initiate calculations.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "UserBirthAndSpaceInput",
  "type": "object",
  "properties": {
    "clientId": { "type": "string", "format": "uuid" },
    "solarDateTime": { "type": "string", "format": "date-time" },
    "gender": { "type": "string", "enum": ["Male", "Female"] },
    "birthPillars": {
      "type": "object",
      "description": "Calculated Four Pillars (Bazi / 八字) representing the celestial coordinates at birth",
      "properties": {
        "year": { "type": "string", "pattern": "^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$" },
        "month": { "type": "string", "pattern": "^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$" },
        "day": { "type": "string", "pattern": "^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$" },
        "hour": { "type": "string", "pattern": "^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$" }
      },
      "required": ["year", "month", "day", "hour"]
    },
    "lunarCalendarData": {
      "type": "object",
      "description": "Astronomically converted Chinese Lunar calendar date",
      "properties": {
        "lunarYear": { "type": "integer", "minimum": 1900 },
        "lunarMonth": { "type": "integer", "minimum": 1, "maximum": 12 },
        "lunarDay": { "type": "integer", "minimum": 1, "maximum": 30 },
        "lunarHourBranch": { "type": "string", "enum": ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] },
        "isLeapMonth": { "type": "boolean" }
      },
      "required": ["lunarYear", "lunarMonth", "lunarDay", "lunarHourBranch", "isLeapMonth"]
    },
    "yangZhaiSectors": {
      "type": "object",
      "description": "Mapped domestic layout sectors of the resident. Maps family members to household coordinates.",
      "properties": {
        "northwestSector": { "type": "string", "enum": ["Father", "Mother", "Eldest Son", "Empty", "Kitchen", "Toilet"] },
        "southwestSector": { "type": "string", "enum": ["Father", "Mother", "Eldest Daughter", "Empty", "Kitchen", "Toilet"] },
        "eastSector": { "type": "string", "enum": ["Father", "Eldest Son", "Empty", "Kitchen", "Toilet"] },
        "southeastSector": { "type": "string", "enum": ["Eldest Daughter", "Empty", "Kitchen", "Toilet"] },
        "northeastSector": { "type": "string", "enum": ["Youngest Son", "Empty"] }
      },
      "required": ["northwestSector", "southwestSector", "eastSector"]
    },
    "humanActions": {
      "type": "object",
      "properties": {
        "ethicalStance": { "type": "string", "enum": ["Junzi", "Xiaoren"], "description": "Junzi practices defensive self-cultivation; Xiaoren pursues reckless greed" },
        "isAggressiveUnderClash": { "type": "boolean", "description": "True if user is actively investing or expanding during a clashing period" }
      },
      "required": ["ethicalStance", "isAggressiveUnderClash"]
    }
  },
  "required": ["clientId", "solarDateTime", "gender", "birthPillars", "lunarCalendarData", "yangZhaiSectors", "humanActions"]
}
```

### 1.2 The Chart Matrix State Schema (JSON)
The calculated output model represents a 12-palace grid (aligned to Earthly Branches index 0-11).

```json
{
  "title": "ZWDSChartMatrix",
  "type": "object",
  "properties": {
    "clientId": { "type": "string", "format": "uuid" },
    "fiveElementsBureau": { "type": "string", "enum": ["Water 2", "Wood 3", "Gold 4", "Earth 5", "Fire 6"] },
    "palaces": {
      "type": "array",
      "minItems": 12,
      "maxItems": 12,
      "items": {
        "type": "object",
        "properties": {
          "earthlyBranchIndex": { "type": "integer", "minimum": 0, "maximum": 11, "description": "0=Zi, 1=Chou, ..., 11=Hai" },
          "earthlyBranchName": { "type": "string", "enum": ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] },
          "palaceName": { "type": "string", "enum": ["命宫", "兄弟宫", "夫妻宫", "子女宫", "财帛宫", "疾厄宫", "迁移宫", "交友宫", "官禄宫", "田宅宫", "福德宫", "父母宫"] },
          "isSelfPalace": { "type": "boolean", "description": "True if this represents the physical 身宫 (Shen Palace) overlay" },
          "startAge": { "type": "integer", "description": "Start age of the decade (Da Xian) range" },
          "endAge": { "type": "integer", "description": "End age of the decade (Da Xian) range" },
          "stars": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": { "type": "string" },
                "level": { "type": "string", "enum": ["Major", "Auxiliary", "Lucky", "Sha"] },
                "wuXing": { "type": "string", "enum": ["Wood", "Fire", "Earth", "Metal", "Water"] },
                "polarization": { "type": "string", "enum": ["Yang", "Yin"] },
                "brightness": { "type": "string", "enum": ["庙", "旺", "得", "利", "平", "陷"] },
                "transformation": { "type": "string", "enum": ["None", "化禄", "化权", "化科", "化忌"] }
              },
              "required": ["name", "level", "wuXing", "transformation"]
            }
          }
        },
        "required": ["earthlyBranchIndex", "earthlyBranchName", "palaceName", "startAge", "endAge", "stars"]
      }
    }
  },
  "required": ["clientId", "fiveElementsBureau", "palaces"]
}
```

---

## 2. Core Calculation Engine

To programmatically construct the 12-palace grid based on a client's birth metadata, follow this execution logic.

### 2.1 Algorithm for Determining Palace Coordinates (命宫 / 身宫)
The position of the fundamental Life Palace (命宫 - *Ming Gong*) and Body Palace (身宫 - *Shen Gong*) is mathematically determined relative to the Earthly Branch coordinates of the birth Month and Hour.

```python
# Earthly Branches are indexed circularly 0 to 11
# Index: 0=寅(Yin), 1=卯(Mao), 2=辰(Chen), 3=巳(Si), 4=午(Wu), 5=未(Wei),
#        6=申(Shen), 7=酉(You), 8=戌(Xu), 9=亥(Hai), 10=子(Zi), 11=丑(Chou)
# Note: In classical calculations, Yin (寅) is always the starting anchor index.

def calculate_base_palaces(lunar_month, hour_branch_index):
    # Determine Ming Gong (Life Palace)
    # Rule: Advance clockwise by Lunar Month, then regress counter-clockwise by Hour Branch
    ming_index = (lunar_month - 1 - hour_branch_index) % 12
    
    # Determine Shen Gong (Body Palace)
    # Rule: Advance clockwise by Lunar Month, then advance clockwise by Hour Branch
    shen_index = (lunar_month - 1 + hour_branch_index) % 12
    
    return {
        "mingGongIndex": ming_index,
        "shenGongIndex": shen_index
    }
```

### 2.2 Constructing the Five-Elements Bureau (五行局)
The Bureau is the celestial "tempo" of the chart, establishing when the client's 10-year major cycles (*Da Xian* 大限) begin. It is calculated using the Heavenly Stem of the Birth Year and the Earthly Branch coordinate of the calculated *Ming Gong*.

| Year Heavenly Stem (Birth Year) | Ming Gong Branch: 寅/卯 (Yin/Mao) | Ming Gong Branch: 辰/巳 (Chen/Si) | Ming Gong Branch: 午/未 (Wu/Wei) | Ming Gong Branch: 申/酉 (Shen/You) | Ming Gong Branch: 戌/亥 (Xu/Hai) | Ming Gong Branch: 子/丑 (Zi/Chou) |
|---|---|---|---|---|---|---|
| **甲 / 己** (Jia / Ji) | Fire 6 | Wood 3 | Water 2 | Gold 4 | Earth 5 | Water 2 |
| **乙 / 庚** (Yi / Geng) | Water 2 | Gold 4 | Earth 5 | Fire 6 | Wood 3 | Earth 5 |
| **丙 / 辛** (Bing / Xin) | Earth 5 | Fire 6 | Wood 3 | Water 2 | Gold 4 | Wood 3 |
| **丁 / 壬** (Ding / Ren) | Wood 3 | Water 2 | Gold 4 | Earth 5 | Fire 6 | Gold 4 |
| **戊 / 癸** (Wu / Gui) | Gold 4 | Earth 5 | Fire 6 | Wood 3 | Water 2 | Fire 6 |

```python
def determine_bureau(year_stem, ming_gong_branch):
    # Lookup implementation based on the matrix above
    # Returns the Bureau object (e.g., {"type": "Water", "value": 2})
    pass
```

### 2.3 Main Star Positioning Engine (紫微星 / 天府星)
The coordinate of the primary master star, **Zi Wei (紫微星)**, dictates the position of all other 13 major stars. Its index is derived from the mathematical division of the **Lunar Birth Day** by the **Bureau Value**:

$$	ext{Dividend} = rac{	ext{Lunar Day}}{	ext{Bureau Value}}$$

```python
def locate_zi_wei_star(lunar_day, bureau_value):
    remainder = lunar_day % bureau_value
    quotient = lunar_day // bureau_value
    
    if remainder == 0:
        index = (quotient - 1) % 12
    else:
        # Adjustment step to maintain circular mathematical mapping
        step = bureau_value - remainder
        if step % 2 == 1:
            index = (quotient + step) % 12
        else:
            index = (quotient - step) % 12
            
    # Normalize index to circular branch arrays (Yin = 0 coordinate)
    return index
```

Once **Zi Wei** is placed, the remaining 13 major stars are placed in strict geometrical relationships:
*   **Zi Wei System** (placed relative to Zi Wei counter-clockwise):
    *   *Tian Ji* = Zi Wei - 1
    *   *Tai Yang* = Zi Wei - 3
    *   *Wu Qu* = Zi Wei - 4
    *   *Tian Tong* = Zi Wei - 5
    *   *Lian Zhen* = Zi Wei - 8
*   **Tian Fu System** (placed relative to Tian Fu clockwise):
    *   *Tian Fu* is mapped opposite to *Zi Wei* across the Yin-Shen axis: $index_{TianFu} = (10 - index_{ZiWei}) \pmod{12}$
    *   *Tai Yin* = Tian Fu + 1
    *   *Tan Lang* = Tian Fu + 2
    *   *Ju Men* = Tian Fu + 3
    *   *Tian Xiang* = Tian Fu + 4
    *   *Tian Liang* = Tian Fu + 5
    *   *Qi Sha* = Tian Fu + 6
    *   *Po Jun* = Tian Fu + 10

---

## 3. Rule Execution & Conditional Logic

The core value of Master Ni's mathematical approach lies in evaluating stellar combinations, clashing vectors, spatial (Yang Zhai) parameters, and tactical human posture.

### 3.1 The Three-Square-Four-Orthogonal Analysis (三方四正)
When evaluating the auspiciousness of any Palace $P_i$, the system must not inspect $P_i$ in isolation. It must scan its opposing and trinal vectors:

```
                            [Opposing: P_opposite]
                                      ^
                                      |
                                      v
    [Trinal: P_left] <-------------> [P_i] <-------------> [Trinal: P_right]
```

*   **P_target**: $i$
*   **P_opposite**: $(i + 6) \pmod{12}$
*   **P_trine_1**: $(i + 4) \pmod{12}$
*   **P_trine_2**: $(i + 8) \pmod{12}$

```python
def evaluate_three_four_harmonies(chart, target_palace_index):
    opposing_idx = (target_palace_index + 6) % 12
    trine_1_idx = (target_palace_index + 4) % 12
    trine_2_idx = (target_palace_index + 8) % 12
    
    scoring_matrix = {
        "favorable_stars": 0,
        "clashing_stars": 0,
        "hua_ji_active": False
    }
    
    for idx in [target_palace_index, opposing_idx, trine_1_idx, trine_2_idx]:
        palace = chart["palaces"][idx]
        for star in palace["stars"]:
            # Weighted scoring implementation
            if star["level"] == "Sha":
                scoring_matrix["clashing_stars"] += 3.0
            elif star["transformation"] == "化忌":
                scoring_matrix["clashing_stars"] += 5.0
                if idx == opposing_idx:
                    # An opposing Hua Ji clashing into target is 2x more destructive
                    scoring_matrix["clashing_stars"] += 5.0
                    scoring_matrix["hua_ji_active"] = True
            elif star["transformation"] in ["化禄", "化权", "化科"]:
                scoring_matrix["favorable_stars"] += 4.0
                
    return scoring_matrix
```

### 3.2 Sibling Palace "Business Partnership" Rule
Master Ni modified traditional ZWDS interpretation by isolating the **Sibling Palace (兄弟宫)** as a strict binary validator for corporate structures and joint-venture compliance.

$$	ext{Partnership Allowed} = f(	ext{Sibling Palace 三方四正}) \ge 	ext{Threshold}$$

```
IF (Sibling Palace has 'Hua Ji' [化忌]) OR (Sibling Palace has 'Qi Sha' [七杀] + 'Sha Star') THEN:
    Partnership_Permitted = FALSE
    Warning_Message = "Extreme structural hazard! Sibling Palace is broken. Joint ventures, business partnerships, and shared liabilities are strictly prohibited. You must run your enterprise as a sole proprietorship."
ELSE:
    Partnership_Permitted = TRUE
```

### 3.3 The Heaven-Earth-Man (HEM) Multi-Factor Optimization Formula
To run the evaluation, the system calculates individual weights (each maxing at $33.33$ points) across the three dimensions of existence.

$$	ext{Final_Score} = 	ext{Heaven_Contribution} + 	ext{Earth_Contribution} + 	ext{Man_Contribution}$$

```
IF (User_Role == "Father" AND Northwest_Sector == "Kitchen") THEN:
    // Fire Burning Heaven's Gate (火烧天门) Warning!
    Earth_Contribution -= 15.0  // Critical spatial penalty
    Trigger_Urgent_Warning("Northwest Kitchen: Extreme risk of professional collapse and cardiac/respiratory incidents.")

IF (User_Role == "Eldest Son" AND East_Sector == "Toilet") THEN:
    // Suppression of the heir
    Earth_Contribution -= 15.0
    Trigger_Urgent_Warning("East Toilet: Suppression of family lineage (no sons/reproduction obstacles).")

IF (User_Role == "Eldest Daughter" AND Southwest_Sector == "Master_Bedroom") THEN:
    // Lonely Star Configuration
    Earth_Contribution -= 10.0
    Trigger_Urgent_Warning("Eldest Daughter in Southwest: Emotional stagnation and 'Lone Star' (孤星到老) configuration.")
```

### 3.4 Flowing Year Back-Propagation Simulation (流年倒推)
Predicts catastrophic failure by analyzing a future window and retroactively flagging an exceptionally positive current year as a setup/trap.

```python
def simulate_flowing_year_back_propagation(timeline, current_age):
    look_ahead_range = [current_age + 1, current_age + 2]
    current_year_node = timeline.get_node(current_age)
    
    # 1. Evaluate current year base quality
    current_score = calculate_base_auspiciousness(current_year_node)
    
    # 2. Check for upcoming catastrophe
    catastrophe_imminent = False
    for future_age in look_ahead_range:
        future_node = timeline.get_node(future_age)
        future_score = calculate_base_auspiciousness(future_node)
        
        # A drop below 20.0 indicates structural failure (Hua Ji clashing with Assets/Wealth)
        if future_score < 20.0:
            catastrophe_imminent = True
            break
            
    # 3. Apply Causal Logic
    if current_score >= 75.0 and catastrophe_imminent:
        return {
            "deceptiveBaitTriggered": True,
            "tacticalActionRequired": "DEFENSIVE",
            "aggressiveStanceScore": 25.0,  # Score if user expands aggressively
            "defensiveStanceScore": 90.0,   # Score if user preserves capital and declines investment
            "guidance": "DO NOT INVEST OR EXPAND! Current prosperity is an astrological setup for upcoming ruin."
        }
        
    return {
        "deceptiveBaitTriggered": False,
        "tacticalActionRequired": "STANDARD"
    }
```

---

## 4. Web Implementation Guidelines

```
  +------------------+      (Four Pillars / Space)       +---------------------+
  |   Frontend UI    | --------------------------------> |     Web Backend     |
  |  (React/Svelte)  | <-------------------------------- | (NodeJS/Python Core)|
  +------------------+         (JSON Chart State)        +---------------------+
```

### 4.1 Backend Engine Optimization
1.  **State Decoupling**: Keep calculations purely functional. Do not store calculation state in memory; use stateless REST endpoints (e.g., `POST /api/v1/chart/calculate`) that receive input birth parameters and return the computed ZWDS Chart JSON state.
2.  **Ephemeris Calculations**: For highly accurate conversions from Solar Birth dates to Lunar Stems and Branches, utilize a verified library (e.g., Python's `lunardate` or Node's `lunar-javascript`) instead of custom mathematical approximations, to avoid boundary day/leap month errors.
3.  **Simulation Speed**: The Flowing Year Back-Propagation simulator runs multiple forward checks. Cap search horizons to 10 years to prevent server latency.

### 4.2 Frontend Rendering Guidelines
1.  **Grid Map Component**: Render the 12 palaces as a circular or rectangular boundary grid layout (matching traditional Chinese ZWDS representations). Index 10 (子) should occupy the bottom center, and index 4 (午) should occupy the top center.
2.  **Vector Highlighting**: Use interactive SVG overlay arrows to dynamically show the **Three-Square-Four-Orthogonal** lines of sight when a user clicks on any specific palace.
3.  **Active Warning Banners**: Highlight palaces flagged with active `Hua Ji` or negative Yang Zhai modifiers using contrasting UI indicators (e.g., amber borders or cautionary alert boxes) to ensure the user's focus is immediately drawn to critical risk zones.
