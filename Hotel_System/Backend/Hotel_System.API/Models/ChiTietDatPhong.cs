using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Hotel_System.API.Models
{
    [Table("ChiTietDatPhong")]
    public class ChiTietDatPhong
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int IDChiTiet { get; set; }

        [Required]
        [StringLength(50)]
        public string IDDatPhong { get; set; } = null!;

        [Required]
        [StringLength(50)]
        public string IDPhong { get; set; } = null!;

        [Required]
        public int SoDem { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal GiaPhong { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ThanhTien { get; set; }

        public string? GhiChu { get; set; }

        // Navigation Properties
        [ForeignKey("IDDatPhong")]
        public virtual DatPhong? DatPhong { get; set; }

        [ForeignKey("IDPhong")]
        public virtual Phong? Phong { get; set; }
    }
}
