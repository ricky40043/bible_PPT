import requests
import time

BASE_URL = "http://localhost:5001"

def run_tests():
    print("🧪 開始測試後端新 API 功能...")
    
    # 1. 經文直讀測試
    res = requests.get(f"{BASE_URL}/api/verses_list/CUNP/GEN/1")
    assert res.status_code == 200, f"經文讀取失敗: {res.text}"
    verses = res.json()
    assert len(verses) > 0, "創世記第一章經文為空"
    print(f"✅ 經文讀取成功，創世記第一章共 {len(verses)} 節: {verses[0]['text'][:20]}...")

    # 2. 註冊測試
    test_email = f"test_{int(time.time())}@example.com"
    reg_res = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": test_email,
        "username": "測試使徒",
        "password": "password123"
    })
    assert reg_res.status_code == 200, f"註冊失敗: {reg_res.text}"
    auth_data = reg_res.json()
    token = auth_data["token"]
    user = auth_data["user"]
    print(f"✅ 註冊成功: {user['username']} ({user['email']}), Token 取得正常")

    headers = {"Authorization": f"Bearer {token}"}

    # 3. 讀經進度測試
    p_res = requests.post(f"{BASE_URL}/api/progress", headers=headers, json={
        "version": "CUNP",
        "book": "JHN",
        "chapter": 3,
        "verse_num": 16
    })
    assert p_res.status_code == 200, f"更新進度失敗: {p_res.text}"
    
    get_p = requests.get(f"{BASE_URL}/api/progress", headers=headers)
    assert get_p.status_code == 200, f"取得進度失敗: {get_p.text}"
    p_data = get_p.json()["progress"]
    assert p_data["book"] == "JHN" and p_data["chapter"] == 3 and p_data["verse_num"] == 16
    print(f"✅ 讀經進度儲存與讀取成功: {p_data['book']} {p_data['chapter']}:{p_data['verse_num']}")

    # 4. 經文高亮標註測試
    hl_res = requests.post(f"{BASE_URL}/api/highlights", headers=headers, json={
        "version": "CUNP",
        "book": "JHN",
        "chapter": 3,
        "verse_num": 16,
        "color": "#fef08a",
        "note": "神愛世人"
    })
    assert hl_res.status_code == 200, f"標註失敗: {hl_res.text}"

    get_hl = requests.get(f"{BASE_URL}/api/highlights?version=CUNP&book=JHN&chapter=3", headers=headers)
    assert get_hl.status_code == 200, f"獲取標註失敗: {get_hl.text}"
    hl_list = get_hl.json()["highlights"]
    assert len(hl_list) == 1 and hl_list[0]["verse_num"] == 16
    print(f"✅ 經文畫線標註儲存與讀取成功: 第 {hl_list[0]['verse_num']} 節 顏色 {hl_list[0]['color']}")

    # 5. 移除標註測試
    del_hl = requests.delete(f"{BASE_URL}/api/highlights?version=CUNP&book=JHN&chapter=3&verse_num=16", headers=headers)
    assert del_hl.status_code == 200, f"刪除標註失敗: {del_hl.text}"
    print("✅ 經文標註刪除成功")

    print("\n🎉 所有 API 整合測試全部通過！")

if __name__ == "__main__":
    run_tests()
