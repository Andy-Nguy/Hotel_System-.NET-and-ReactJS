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

UPDATE Phong SET UrlAnhPhong = 
'[{"u": "room-P401-a0.jpg"}, {"u": "room-P401-a1.jpg"}, {"u": "room-P401-a2.jpg"}]'
WHERE IDPhong = 'P401';

UPDATE Phong SET UrlAnhPhong = 
'[{"u": "room-P601-a0.jpg"}, {"u": "room-P601-a1.jpg"}, {"u": "room-P601-a2.jpg"}, {"u": "room-P601-a3.jpg"}]'
WHERE IDPhong = 'P601';

UPDATE Phong SET UrlAnhPhong = 
'[{"u": "room-P201-a0.jpg"}, {"u": "room-P201-a1.jpg"}, {"u": "room-P201-a2.jpg"}, {"u": "room-P201-a3.jpg"}]'
WHERE IDPhong = 'P201';

UPDATE Phong SET UrlAnhPhong = 
'[{"u": "room-P301-a0.jpg"}, {"u": "room-P301-a1.jpg"}, {"u": "room-P301-a2.jpg"}]'
WHERE IDPhong = 'P301';

UPDATE Phong SET UrlAnhPhong = 
'[{"u": "room-P501-a0.jpg"}, {"u": "room-P501-a1.jpg"}, {"u": "room-P501-a2.jpg"}, {"u": "room-P501-a3.jpg"}]'
WHERE IDPhong = 'P501';

UPDATE Phong SET UrlAnhPhong = 
'[{"u": "room-P101-a0.jpg"}, {"u": "room-P101-a1.jpg"}, {"u": "room-P101-a2.jpg"}]'
WHERE IDPhong = 'P101';

UPDATE Phong SET UrlAnhPhong = 
'[{"u": "room-P102-a0.jpg"}, {"u": "room-P102-a1.jpg"}, {"u": "room-P102-a2.jpg"}]'
WHERE IDPhong = 'P102';
