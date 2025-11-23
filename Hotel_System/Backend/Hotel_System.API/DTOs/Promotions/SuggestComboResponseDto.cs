using System;
using System.Collections.Generic;

namespace Hotel_System.API.DTOs.Promotions;

public class SuggestComboResponseDto
{
    public string IdkhuyenMaiCombo { get; set; } = null!;
    public string TenCombo { get; set; } = null!;
    public List<string> DichVuIds { get; set; } = new List<string>();
    public int MatchingCount { get; set; }
}
