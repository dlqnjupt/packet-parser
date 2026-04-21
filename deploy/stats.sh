#!/bin/bash

LOG_FILE="/var/log/nginx/packet-parser-access.log"

echo "=========================================="
echo "  Packet Parser 使用统计"
echo "=========================================="
echo ""

# 总解析次数
total=$(grep -c 'POST /api/parse' "$LOG_FILE" 2>/dev/null || echo "0")
echo "📊 总解析次数: $total"
echo ""

# 按协议统计
echo "📋 按协议统计:"
echo "-------------------------------------------"
grep 'POST /api/parse' "$LOG_FILE" 2>/dev/null | \
    sed -n 's/.*"protocol":"\([^"]*\)".*/\1/p' | \
    sort | uniq -c | sort -rn | \
    while read count proto; do
        printf "  %-20s %s 次\n" "$proto" "$count"
    done
echo ""

# 按日期统计（最近7天）
echo "📅 按日期统计（最近7天）:"
echo "-------------------------------------------"
grep 'POST /api/parse' "$LOG_FILE" 2>/dev/null | \
    awk '{print substr($4, 2, 11)}' | \
    sort | uniq -c | sort -k2 | tail -7 | \
    while read count date; do
        printf "  %-15s %s 次\n" "$date" "$count"
    done
echo ""

# 按小时统计（今天）
today=$(date +%d/%b/%Y)
echo "⏰ 今日按小时统计:"
echo "-------------------------------------------"
grep 'POST /api/parse' "$LOG_FILE" 2>/dev/null | \
    grep "$today" | \
    awk '{print substr($4, 14, 2)}' | \
    sort | uniq -c | sort -k2 | \
    while read count hour; do
        printf "  %s:00 - %s 次\n" "$hour" "$count"
    done
echo ""

# 按IP统计（Top 10）
echo "👥 活跃用户 IP（Top 10）:"
echo "-------------------------------------------"
grep 'POST /api/parse' "$LOG_FILE" 2>/dev/null | \
    awk '{print $1}' | \
    sort | uniq -c | sort -rn | head -10 | \
    while read count ip; do
        printf "  %-18s %s 次\n" "$ip" "$count"
    done
echo ""

echo "=========================================="
echo "统计时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
