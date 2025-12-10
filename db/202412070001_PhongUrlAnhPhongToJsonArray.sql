ALTER TABLE Phong
    ALTER COLUMN UrlAnhPhong TYPE JSONB
    USING 
        CASE 
            WHEN UrlAnhPhong IS NULL THEN '[]'::jsonb
            ELSE jsonb_build_array(jsonb_build_object('u', UrlAnhPhong))
        END;

ALTER TABLE Phong
ADD CONSTRAINT phong_urlanhphong_array_valid CHECK (
    jsonb_typeof(UrlAnhPhong) = 'array'
    AND jsonb_array_length(UrlAnhPhong) BETWEEN 1 AND 6
    AND (UrlAnhPhong->0->>'u') IS NOT NULL
    AND trim(UrlAnhPhong->0->>'u') <> ''
);

ALTER TABLE HoaDon
ADD COLUMN DiemSuDung INT DEFAULT 0;